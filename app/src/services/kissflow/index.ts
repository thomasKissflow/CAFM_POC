// Kissflow-backed services: the app's own services run over data hydrated from Kissflow (hydrate.ts), and every
// write that Kissflow models is sent to Kissflow through the SDK. Reads stay in memory so screens are instant.
import type { Services, NewRequestInput, CloseoutInput } from "@/services/types";
import type { AssetClass, SnagStatus } from "@/domain/types";
import { addMonthsGst, ms, toGst } from "@/domain/time";
import { ASSET_CLASS_META } from "@/services/mock/reference";
import { createMockServices } from "@/services/mock";
import { FLOW, SNAG_STATUS, CHANNEL_TO_KF, SITE_KIND_TO_KF, titleFor } from "./ids";
import { hydrate, type Hydrated } from "./hydrate";
import { kissflowConversations } from "./conversations";
import { kissflowAiSettings } from "./aiSettings";
import { apiPost, kfDate, kfDateTime, listAll, processItems, str, type Kf, type KfRow } from "./sdk";

export interface KissflowConnection { services: Services; kf: Kf; hydrated: Hydrated; syncErrors: () => string[] }

const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));
const WARRANTY_MONTHS: Record<AssetClass, number> = Object.fromEntries(
  Object.entries(ASSET_CLASS_META).map(([k, m]) => [k, m.warrantyMonths])
) as Record<AssetClass, number>;

/** Dataform rows delete cleanly over REST; the SDK's handle has no delete, so this goes through kf.api. */
const deleteRow = (kf: Kf, form: string, id: string) => kf.api(`/form/2/${kf.account._id}/${form}/${id}`, { method: "DELETE" });

/** Creates rows a few at a time: a 60-apartment tower in a couple of seconds, without a burst Kissflow throttles. */
async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) await fn(next);
  });
  await Promise.all(workers);
}

export async function createKissflowServices(kf: Kf): Promise<KissflowConnection> {
  const hydrated = await hydrate(kf);
  const { ids } = hydrated;
  const mock = createMockServices(hydrated.db);
  const wo = kf.app.getProcess(FLOW.workOrder);
  const errors: string[] = [];

  /** The activity instance to act on now: list the item, then read its current context. */
  async function currentActivity(instanceId: string): Promise<string> {
    const rows = await processItems(wo, "Work orders (act)");
    const row = rows.find((r) => r._id === instanceId);
    if (row === undefined) throw new Error(`Work order ${instanceId} is not visible in Kissflow for this user`);
    const listed = str(row._activity_instance_id);
    if (listed === undefined) throw new Error(`Work order ${instanceId} has no activity instance`);
    const detail = await wo.getItem({ instanceId, activityInstanceId: listed });
    const ctx = Array.isArray(detail._current_context) ? (detail._current_context[0] as Record<string, unknown> | undefined) : undefined;
    const current = ctx !== undefined && ctx !== null ? str(ctx._context_activity_instance_id) : undefined;
    return current !== undefined ? current : listed;
  }
  async function step(appId: string, data?: Record<string, unknown>) {
    const instanceId = ids.workOrder.get(appId);
    if (instanceId === undefined) throw new Error(`Work order ${appId} is not linked to Kissflow`);
    const activityInstanceId = await currentActivity(instanceId);
    if (data !== undefined) await wo.updateItem({ instanceId, activityInstanceId, data });
    await wo.submitItem({ instanceId, activityInstanceId });
  }
  const excludedFor = (rootCause: string): boolean | undefined => {
    const row = ids.rootCauseRow.get(rootCause);
    return row === undefined ? undefined : row.Excluded_From_DLP === true;
  };
  const sync = async (what: string, fn: () => Promise<void>) => {
    try { await fn(); }
    catch (e) { const msg = `${what}: ${e instanceof Error ? e.message : String(e)}`; errors.push(msg); throw new Error(`Saved on screen, but Kissflow refused it (${msg})`); }
  };

  const services: Services = {
    ...mock,
    conversations: kissflowConversations(kf, (appId) => ids.workOrder.get(appId)),
    aiSettings: kissflowAiSettings(kf),
    workOrders: {
      ...mock.workOrders,
      async create(input: NewRequestInput, actorId: string) {
        const created = await mock.workOrders.create(input, actorId);
        await sync("raise request", async () => {
          const site = ids.siteRow.get(created.siteId), cat = ids.categoryRow.get(created.category);
          const asset = created.assetId !== undefined ? ids.assetRow.get(created.assetId) : undefined;
          if (site === undefined || cat === undefined) throw new Error("site or request type missing in Kissflow");
          const data: Record<string, unknown> = {
            Site: { _id: site._id }, Category: { _id: cat._id }, Request_Title: titleFor(created.ref, created.title.en), Description: created.description,
            Channel: CHANNEL_TO_KF[created.channel], Reporter_Name: created.reporterName, First_Contact_At: kfDateTime(created.reportedAt),
            // copy fields: an API create does not run lookup autofill (DATA_MODEL §16)
            Own_Operations: site.Own_Operations === true, Base_Priority: cat.Base_Priority, Summer_Uplift: cat.Summer_Uplift === true, Structural: cat.Structural === true,
            DLP_End_Date: asset !== undefined && asset.DLP_End_Date !== undefined ? asset.DLP_End_Date : site.DLP_End_Date,
            Warranty_End_Date: asset !== undefined ? asset.Warranty_End_Date : undefined, Asset_Tag: asset !== undefined ? asset.Asset_Tag : undefined, Batch: asset !== undefined ? asset.Batch : undefined,
            Vulnerable_Occupant: created.vulnerableOccupant === true, Access_Window: created.accessWindow,
            Conversation_Transcript: created.transcript !== undefined ? created.transcript.map((l) => `${l.role === "agent" ? "CAFM" : "Caller"}: ${l.text}`).join("\n") : undefined
          };
          if (asset !== undefined) data.Asset = { _id: asset._id };
          // Installed By drives the DLP back-charge (its Subcontractor is mandatory): copy it from the asset's installer.
          const installer = asset !== undefined ? asset.Installed_By : undefined;
          if (installer !== undefined && installer !== null && typeof installer === "object" && typeof (installer as { _id?: unknown })._id === "string") data.Installed_By = { _id: (installer as { _id: string })._id };
          if (created.unitId !== undefined && ids.unit.get(created.unitId) !== undefined) data.Unit = { _id: ids.unit.get(created.unitId) };
          const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== ""));
          const item = await wo.createItem({ data: clean });
          ids.workOrder.set(created.id, item._id);
          await wo.submitItem({ instanceId: item._id, activityInstanceId: item._activity_instance_id }); // Request raised → Triage
          await step(created.id); // Triage → dispatch (the demo's intake triages automatically)
        });
        return created;
      },
      async accept(id, actorId, technicianId) {
        const r = await mock.workOrders.accept(id, actorId, technicianId);
        await sync("accept", () => step(id));
        return r;
      },
      async arrive(id, actorId) {
        const r = await mock.workOrders.arrive(id, actorId);
        await sync("arrive", async () => {
          const instanceId = ids.workOrder.get(id);
          if (instanceId === undefined) return;
          await wo.updateItem({ instanceId, activityInstanceId: await currentActivity(instanceId), data: { Arrived_At: kfDateTime(new Date(mock.clock.now()).toISOString()) } });
        });
        return r;
      },
      async resolve(id, input: CloseoutInput, actorId) {
        const r = await mock.workOrders.resolve(id, input, actorId);
        await sync("resolve", () => step(id, {
          Root_Cause: ids.rootCause.get(input.rootCause) !== undefined ? { _id: ids.rootCause.get(input.rootCause) } : undefined,
          // Root Cause autofill is off (it targeted a field the WO doesn't have, which made Kissflow refuse the update), so
          // the adapter copies "Excluded From DLP" itself; it feeds the liability formula (chargeable if excluded).
          Excluded_From_DLP: excludedFor(input.rootCause),
          Labour_AED: input.labourAed, Closeout_Note: input.note, Resolved_At: kfDateTime(new Date(mock.clock.now()).toISOString())
        }));
        return r;
      },
      async verifyAndClose(id, actorId) {
        const r = await mock.workOrders.verifyAndClose(id, actorId);
        await sync("verify and close", () => step(id, { Verified_At: kfDateTime(new Date(mock.clock.now()).toISOString()) }));
        return r;
      }
    },
    handover: {
      ...mock.handover,
      async moveSnag(id, status: SnagStatus) {
        const r = await mock.handover.moveSnag(id, status);
        await sync("move snag", async () => {
          const s = ids.snag.get(id);
          if (s === undefined) throw new Error("snag not linked to Kissflow");
          await apiPost(kf, `/case/2/${kf.account._id}/${FLOW.snag}/${s.id}/${s.statusId}/move`, { _status_id: SNAG_STATUS[status] });
          ids.snag.set(id, { id: s.id, statusId: SNAG_STATUS[status] });
        });
        return r;
      }
    },
    dlp: {
      ...mock.dlp,
      async setBackChargeStatus(id, status, actorId) {
        const r = await mock.dlp.setBackChargeStatus(id, status, actorId);
        await sync("back-charge status", async () => {
          const bc = hydrated.db.backCharges.find((b) => b.id === id);
          const wo2 = bc !== undefined ? hydrated.db.workOrders.find((w) => w.id === bc.workOrderId) : undefined;
          const row = wo2 !== undefined ? ids.register.get(wo2.ref) : undefined;
          if (row === undefined) throw new Error("history row not found");
          await kf.app.getDataform(FLOW.register).updateItem({ itemId: row, data: { Back_charge_Status: status, ...(status === "recovered" ? { Recovered_On: kfDate(new Date(mock.clock.now()).toISOString()) } : {}) } });
        });
        return r;
      }
    },
    estate: {
      persists: true,
      // Kissflow first, then the screens: a building that Kissflow refused must not appear on the portfolio.
      async addProperty(input, onProgress) {
        const code = input.site.code.trim().toUpperCase();
        const total = 1 + input.units.length + input.assets.length;
        let done = 0;
        const tick = () => { done += 1; if (onProgress !== undefined) onProgress(done, total); };
        const siteForm = kf.app.getDataform(FLOW.site), unitForm = kf.app.getDataform(FLOW.unit), assetForm = kf.app.getDataform(FLOW.asset);

        const existing = await listAll(siteForm, "Sites (check)", 200);
        if (existing.some((r) => str(r.Site_Code)?.toUpperCase() === code)) throw new Error(`${code} is already a building in Kissflow`);
        const classes = new Map((await listAll(kf.app.getDataform(FLOW.assetClass), "Asset classes", 100)).map((r) => [str(r.Class_Code) ?? "", r._id]));

        const dlpEnd = input.site.tocDate !== undefined && input.site.dlpMonths !== undefined
          ? kfDate(toGst(ms(addMonthsGst(input.site.tocDate, input.site.dlpMonths)) - 1000)) : undefined;
        const siteRow = await siteForm.createItem({ data: clean({
          Site_Code: code, Site_Name: input.site.name.en, Site_Name_AR: input.site.name.ar, District: input.site.district.en,
          Site_Kind: SITE_KIND_TO_KF[input.site.kind], Client_Name: input.site.client.en, Own_Operations: input.site.ownOperations,
          TOC_Date: input.site.tocDate !== undefined ? kfDate(input.site.tocDate) : undefined, DLP_Months: input.site.dlpMonths, DLP_End_Date: dlpEnd,
          Floors: input.site.floors, Unit_Count: input.site.unitCount, Beds: input.site.beds
        }) });
        tick();

        const unitRows = new Map<string, string>();
        await pool(input.units, 6, async (u) => {
          const row = await unitForm.createItem({ data: { Unit_Number: u.number, Site: { _id: siteRow._id }, Floor: u.floor } });
          unitRows.set(u.number, row._id);
          tick();
        });

        const assetRows = new Map<string, KfRow>();
        await pool(input.assets, 6, async (a) => {
          const unitId = a.unitNumber !== undefined ? unitRows.get(a.unitNumber) : undefined;
          const installer = a.installedBy !== undefined ? ids.subcontractor.get(a.installedBy) : undefined;
          const warrantyEnd = a.handoverDate !== undefined ? kfDate(addMonthsGst(a.handoverDate, WARRANTY_MONTHS[a.assetClass])) : undefined;
          const row = await assetForm.createItem({ data: clean({
            Asset_Tag: a.tag, QR_Code: `TSL:${code}:${a.tag}`, Site: { _id: siteRow._id }, Unit: unitId !== undefined ? { _id: unitId } : undefined,
            Floor: a.floor, Location: a.location.en, Location_AR: a.location.ar, Asset_Class: classes.get(a.assetClass) !== undefined ? { _id: classes.get(a.assetClass) } : undefined,
            Installed_By: installer !== undefined ? { _id: installer } : undefined, Asset_Status: "Operational",
            Handover_Date: a.handoverDate !== undefined ? kfDate(a.handoverDate) : undefined, Warranty_End_Date: warrantyEnd,
            DLP_End_Date: a.handoverDate !== undefined && input.site.dlpMonths !== undefined ? kfDate(toGst(ms(addMonthsGst(a.handoverDate, input.site.dlpMonths)) - 1000)) : undefined
          }) });
          assetRows.set(a.tag, row);
          tick();
        });

        // now the screens: the same building in memory, with its Kissflow rows registered so a job can be raised on it today
        const added = await mock.estate.addProperty(input);
        ids.site.set(added.site.id, siteRow._id);
        ids.siteRow.set(added.site.id, { ...siteRow, Own_Operations: input.site.ownOperations, DLP_End_Date: dlpEnd });
        for (const u of added.units) { const row = unitRows.get(u.number); if (row !== undefined) ids.unit.set(u.id, row); }
        for (const a of added.assets) {
          const row = assetRows.get(a.tag);
          if (row === undefined) continue;
          ids.asset.set(a.id, row._id);
          ids.assetRow.set(a.id, row);
        }
        return added;
      },
      async removeProperty(siteId) {
        const row = ids.site.get(siteId);
        if (row === undefined) throw new Error("that building is not linked to Kissflow");
        // refuse first, so a building with history is never half-deleted
        const assetIds = hydrated.db.assets.filter((a) => a.siteId === siteId).map((a) => a.id);
        const unitIds = hydrated.db.units.filter((u) => u.siteId === siteId).map((u) => u.id);
        await mock.estate.removeProperty(siteId);
        await sync("remove property", async () => {
          for (const id of assetIds) { const r = ids.asset.get(id); if (r !== undefined) { await deleteRow(kf, FLOW.asset, r); ids.asset.delete(id); ids.assetRow.delete(id); } }
          for (const id of unitIds) { const r = ids.unit.get(id); if (r !== undefined) { await deleteRow(kf, FLOW.unit, r); ids.unit.delete(id); } }
          await deleteRow(kf, FLOW.site, row);
          ids.site.delete(siteId);
          ids.siteRow.delete(siteId);
        });
      }
    },
    demo: {
      ...mock.demo,
      reset() { window.location.reload(); } // Kissflow holds the data: reload re-reads it
    }
  };
  return { services, kf, hydrated, syncErrors: () => [...errors] };
}
