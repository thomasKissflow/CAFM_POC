// Loads CAFM data from Kissflow into the app's in-memory Db shape.
// Kissflow is the source of truth for what exists and its state (step, liability, priority, dates, costs).
// Presentation detail Kissflow doesn't store (Arabic text, photos, checklists, history timelines, chat) comes from the
// same deterministic generator that seeded Kissflow, matched on natural keys (site code, QR code, WO ref, …). See D51.
import type { Asset, AssetClass, BackCharge, Breakdown, ComplianceItem, Equipment, PpmSchedule, Site, Snag, Subcontractor, Unit, WoStatus, WorkOrder } from "@/domain/types";
import { buildSeed, type Db } from "@/services/mock/seed";
import { ASSET_CLASS_META } from "@/services/mock/reference";
import { FLOW, HASSANTUK_FROM_KF, LIABILITY_BY_CODE, PRIORITY_BY_CODE, SITE_KIND_FROM_KF, SNAG_BY_NAME, STEP, TRADE_FROM_KF, CHANNEL_FROM_KF, EQ_STATUS_FROM_KF, isTestItem, refFromTitle } from "./ids";
import { isoDate, listAll, listBoard, num, processItems, refId, str, type Kf, type KfRow } from "./sdk";
import { shiftDemoRows } from "@/domain/demoTime";
import { MINUTE, ms, toGst } from "@/domain/time";
import { dueDates } from "@/domain/sla";

/** Kissflow ids for everything the adapter may write back to. */
export interface KfIds {
  site: Map<string, string>;        // app site id → Kissflow _id
  unit: Map<string, string>;        // app unit id → Kissflow _id
  asset: Map<string, string>;       // app asset id → Kissflow _id
  subcontractor: Map<string, string>;
  category: Map<string, string>;    // category key → Kissflow _id
  rootCause: Map<string, string>;   // root-cause key → Kissflow _id
  rootCauseRow: Map<string, KfRow>;
  categoryRow: Map<string, KfRow>;
  siteRow: Map<string, KfRow>;
  assetRow: Map<string, KfRow>;
  workOrder: Map<string, string>;   // app WO id → process instance id
  register: Map<string, string>;    // WO ref → register row _id
  snag: Map<string, { id: string; statusId: string }>;
}

export interface Hydrated { db: Db; ids: KfIds; counts: Record<string, number> }

/** The admin list has no _current_step: infer it from who the item is assigned to (one role per step in this process). */
function stepOf(r: KfRow): string | undefined {
  const explicit = str(r._current_step);
  if (explicit !== undefined) return explicit;
  const assigned = Array.isArray(r._current_assigned_to) ? (r._current_assigned_to as Array<{ Name?: unknown }>).map((a) => (a !== null && typeof a === "object" ? a.Name : undefined)) : [];
  if (assigned.includes("Subcontractor Supervisor")) return STEP.subDispatch;
  if (assigned.includes("FM Manager")) return STEP.fmDispatch;
  if (assigned.includes("DLP Manager")) return STEP.engineering;
  if (assigned.includes("Technician")) return STEP.wip;
  if (assigned.includes("Helpdesk")) return str(r.Resolved_At) !== undefined ? STEP.verify : STEP.triage;
  return undefined;
}

const stepToStatus = (step: string | undefined): WoStatus => {
  if (step === STEP.wip) return "in_progress";
  if (step === STEP.verify) return "resolved";
  if (step === STEP.subDispatch || step === STEP.fmDispatch || step === STEP.engineering) return "assigned";
  return "new";
};

export async function hydrate(kf: Kf): Promise<Hydrated> {
  const base = buildSeed();
  const app = kf.app;
  const [sites, subs, units, assets, cats, rcs, register, compliance, ppm, equipment, snags, breakdowns, woRows, classes] = (await Promise.all([
    listAll(app.getDataform(FLOW.site), "Sites"), listAll(app.getDataform(FLOW.subcontractor), "Subcontractors"), listAll(app.getDataform(FLOW.unit), "Apartments"),
    listAll(app.getDataform(FLOW.asset), "Assets"), listAll(app.getDataform(FLOW.category), "Request types"), listAll(app.getDataform(FLOW.rootCause), "Fault causes"),
    listAll(app.getDataform(FLOW.register), "WO history"), listAll(app.getDataform(FLOW.compliance), "Certificates"), listAll(app.getDataform(FLOW.ppm), "PPM"),
    listAll(app.getDataform(FLOW.equipment), "Plant"), listBoard(kf, FLOW.snag, "Snags"), listBoard(kf, FLOW.breakdown, "Breakdowns"),
    processItems(app.getProcess(FLOW.workOrder), "Work orders"), listAll(app.getDataform(FLOW.assetClass), "Asset classes")
    // Demo records were seeded around the design date and their dates are moved to today, exactly like the
    // generated data (domain/demoTime.ts). Anything raised since the app started using the real clock is left
    // as Kissflow stored it, so a request raised in a demo keeps its real timestamp.
  ])).map((rows) => shiftDemoRows(rows)) as [KfRow[], KfRow[], KfRow[], KfRow[], KfRow[], KfRow[], KfRow[], KfRow[], KfRow[], KfRow[], KfRow[], KfRow[], KfRow[], KfRow[]];
  const ids: KfIds = { site: new Map(), unit: new Map(), asset: new Map(), subcontractor: new Map(), category: new Map(), rootCause: new Map(), rootCauseRow: new Map(), categoryRow: new Map(), siteRow: new Map(), assetRow: new Map(), workOrder: new Map(), register: new Map(), snag: new Map() };

  // ---- sites (by code) ----
  const kfSiteById = new Map<string, Site>();
  const outSites: Site[] = [];
  for (const r of sites) {
    const code = str(r.Site_Code);
    if (code === undefined) continue;
    const b = base.sites.find((s) => s.code === code);
    const kind = SITE_KIND_FROM_KF[str(r.Site_Kind) ?? ""];
    const site: Site = {
      ...(b !== undefined ? b : { id: `S-${code}`, code, name: { en: code, ar: code }, district: { en: "", ar: "" }, kind: kind ?? "residential_tower", client: { en: "", ar: "" }, ownOperations: false }),
      ownOperations: r.Own_Operations === true,
      ...(isoDate(r.TOC_Date) !== undefined ? { tocDate: isoDate(r.TOC_Date) } : {}),
      ...(num(r.DLP_Months) !== undefined ? { dlpMonths: num(r.DLP_Months) } : {}),
      // the building's size comes from Kissflow too, so the tile matches the apartments in the register
      ...(num(r.Unit_Count) !== undefined ? { unitCount: num(r.Unit_Count) } : {}),
      ...(num(r.Floors) !== undefined ? { floors: num(r.Floors) } : {})
    };
    if (b === undefined) {
      // a building added in the app (Admin → Properties) isn't in the generator, so every word of it comes from Kissflow
      site.name = { en: str(r.Site_Name) ?? code, ar: str(r.Site_Name_AR) ?? str(r.Site_Name) ?? code };
      const district = str(r.District), client = str(r.Client_Name);
      if (district !== undefined) site.district = { en: district, ar: district };
      if (client !== undefined) site.client = { en: client, ar: client };
      if (kind !== undefined) site.kind = kind;
      const beds = num(r.Beds); if (beds !== undefined) site.beds = beds;
    }
    outSites.push(site);
    ids.site.set(site.id, r._id);
    ids.siteRow.set(site.id, r);
    kfSiteById.set(r._id, site);
  }

  // ---- subcontractors (by company name) ----
  const outSubs: Subcontractor[] = [];
  const kfSubById = new Map<string, Subcontractor>();
  for (const r of subs) {
    const name = str(r.Company_Name);
    if (name === undefined) continue;
    const b = base.subcontractors.find((s) => s.name === name);
    const sub: Subcontractor = b !== undefined ? { ...b } : {
      id: `SC-${name.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase()}`, name, nameAr: str(r.Company_Name_AR) ?? name, trade: TRADE_FROM_KF[str(r.Trade) ?? ""] ?? "hvac",
      tradeLicenceNo: str(r.Trade_Licence_No) ?? "", tradeLicenceExpiry: isoDate(r.Trade_Licence_Expiry) ?? "", insuranceExpiry: isoDate(r.Insurance_Expiry) ?? "", civilDefenceApproved: r.Civil_Defence_Approved === true
    };
    const exp = isoDate(r.Trade_Licence_Expiry); if (exp !== undefined) sub.tradeLicenceExpiry = exp;
    const ins = isoDate(r.Insurance_Expiry); if (ins !== undefined) sub.insuranceExpiry = ins;
    outSubs.push(sub);
    ids.subcontractor.set(sub.id, r._id);
    kfSubById.set(r._id, sub);
  }

  // ---- categories and root causes (by code) ----
  for (const r of cats) { const c = str(r.Category_Code); if (c !== undefined) { ids.category.set(c, r._id); ids.categoryRow.set(c, r); } }
  for (const r of rcs) { const c = str(r.Root_Cause_Code); if (c !== undefined) { ids.rootCause.set(c, r._id); ids.rootCauseRow.set(c, r); } }

  // ---- units (by site + number) ----
  const outUnits: Unit[] = [];
  for (const r of units) {
    const site = kfSiteById.get(refId(r.Site) ?? "");
    const n = str(r.Unit_Number);
    if (site === undefined || n === undefined) continue;
    const b = base.units.find((u) => u.siteId === site.id && u.number === n);
    const unit: Unit = b !== undefined ? b : { id: `U-${site.code}-${n}`, siteId: site.id, floor: num(r.Floor) ?? 0, number: n };
    outUnits.push(unit);
    ids.unit.set(unit.id, r._id);
  }

  // ---- assets (by QR code: tags repeat across towers) ----
  // Class_Code is the app's own AssetClass key, so an asset added outside the demo set keeps its real class and trade.
  const classByRow = new Map<string, AssetClass>();
  for (const r of classes) {
    const code = str(r.Class_Code);
    if (code !== undefined && code in ASSET_CLASS_META) classByRow.set(r._id, code as AssetClass);
  }
  const outAssets: Asset[] = [];
  for (const r of assets) {
    const qr = str(r.QR_Code);
    if (qr === undefined) continue; // every register asset has a QR code; the three early test assets (Phase 4) don't
    const b = base.assets.find((a) => a.qrCode === qr);
    const site = kfSiteById.get(refId(r.Site) ?? "");
    if (site === undefined) continue;
    const installer = kfSubById.get(refId(r.Installed_By) ?? "");
    const cls = classByRow.get(refId(r.Asset_Class) ?? "") ?? "FCU";
    const meta = ASSET_CLASS_META[cls];
    const asset: Asset = b !== undefined ? { ...b } : {
      id: `A-${site.code}-${str(r.Asset_Tag) ?? r._id}`, tag: str(r.Asset_Tag) ?? r._id, qrCode: qr ?? `KF:${r._id}`, siteId: site.id, floor: num(r.Floor) ?? 0,
      location: { en: str(r.Location) ?? "", ar: str(r.Location_AR) ?? str(r.Location) ?? "" }, assetClass: cls, trade: meta.trade, make: str(r.Make) ?? meta.make, model: str(r.Model) ?? meta.model,
      serial: str(r.Serial_Number) ?? "", installedBy: installer !== undefined ? installer.id : "", status: "operational"
    };
    const unitRow = refId(r.Unit);
    if (b === undefined && unitRow !== undefined) {
      const u = outUnits.find((x) => ids.unit.get(x.id) === unitRow);
      if (u !== undefined) asset.unitId = u.id;
    }
    const dlp = isoDate(r.DLP_End_Date); if (dlp !== undefined) asset.dlpEnd = dlp;
    const war = isoDate(r.Warranty_End_Date); if (war !== undefined) asset.warrantyEnd = war;
    const bat = str(r.Batch); if (bat !== undefined) asset.batch = bat;
    if (installer !== undefined) asset.installedBy = installer.id;
    outAssets.push(asset);
    ids.asset.set(asset.id, r._id);
    ids.assetRow.set(asset.id, r);
  }

  // ---- work orders: closed ones from the register, open ones from the live process ----
  const outWos: WorkOrder[] = [];
  const keptRefs = new Set<string>();
  for (const r of register) {
    const ref = str(r.Work_Order_No);
    if (ref === undefined) continue;
    ids.register.set(ref, r._id);
    const b = base.workOrders.find((w) => w.ref === ref);
    if (b === undefined) continue; // history rows written by integrations for live WOs are joined below
    const wo: WorkOrder = { ...b, status: "closed" };
    const lc = num(r.Liability_Code); if (lc !== undefined && LIABILITY_BY_CODE[lc] !== undefined) wo.liability = LIABILITY_BY_CODE[lc];
    const pc = num(r.Priority_Code); if (pc !== undefined && PRIORITY_BY_CODE[pc] !== undefined) wo.priority = PRIORITY_BY_CODE[pc];
    const closed = isoDate(r.Closed_At); if (closed !== undefined) wo.closedAt = closed;
    const parts = num(r.Parts_AED); if (parts !== undefined) wo.partsAed = parts;
    const labour = num(r.Labour_AED); if (labour !== undefined) wo.labourAed = labour;
    outWos.push(wo);
    keptRefs.add(ref);
  }
  // getAdminItems returns items in every state: skip rejected / withdrawn / draft, and let an in-progress copy win over
  // an older rejected one with the same ref (a rejected seed duplicate once showed up as an extra open job).
  const liveRows = woRows.filter((r) => { const st = str(r._status); return st === undefined || st === "InProgress" || st === "Completed"; });
  liveRows.sort((a, b) => (str(a._status) === "InProgress" ? 0 : 1) - (str(b._status) === "InProgress" ? 0 : 1));
  const seenRefs = new Set<string>();
  for (const r of liveRows) {
    if (isTestItem(r.Request_Title)) continue;
    const refKey = refFromTitle(r.Request_Title);
    if (refKey !== undefined) { if (seenRefs.has(refKey) || keptRefs.has(refKey)) continue; seenRefs.add(refKey); }
    const ref = refFromTitle(r.Request_Title);
    const step = stepOf(r);
    const b = ref !== undefined ? base.workOrders.find((w) => w.ref === ref) : undefined;
    const site = kfSiteById.get(refId(r.Site) ?? "");
    if (site === undefined) continue;
    const lc = num(r.Liability_Code), pc = num(r.Priority_Code);
    const wo: WorkOrder = b !== undefined ? { ...b } : {
      id: r._id, ref: ref ?? `WO-KF-${r._id.slice(-5)}`, siteId: site.id, category: "civil_finishes", title: { en: str(r.Request_Title) ?? "", ar: str(r.Request_Title) ?? "" },
      description: str(r.Description) ?? "", descriptionLang: "en", channel: CHANNEL_FROM_KF[str(r.Channel) ?? ""] ?? "helpdesk", reporterName: str(r.Reporter_Name),
      reportedAt: isoDate(r.First_Contact_At) ?? new Date().toISOString(), priority: "P3", summerUplift: r.Summer_Uplift === true, liability: "CHARGEABLE",
      liabilityReason: { en: "Computed by Kissflow", ar: "محسوبة في Kissflow" }, status: "new", assigneeOrg: "fm", responseDueAt: new Date().toISOString(), resolveDueAt: new Date().toISOString(),
      checklist: [], photos: [], events: []
    };
    if (b === undefined) {
      const catKey = [...ids.category.entries()].find(([, id]) => id === refId(r.Category));
      if (catKey !== undefined) wo.category = catKey[0] as WorkOrder["category"];
    }
    wo.status = str(r._status) === "Completed" ? "closed" : stepToStatus(step);
    if (lc !== undefined && LIABILITY_BY_CODE[lc] !== undefined) wo.liability = LIABILITY_BY_CODE[lc];
    if (pc !== undefined && PRIORITY_BY_CODE[pc] !== undefined) wo.priority = PRIORITY_BY_CODE[pc];
    if (b === undefined) {
      // A request raised in the app (not part of the demo set): its clocks come from Kissflow's own SLA figures,
      // falling back to the published matrix for the priority Kissflow assigned.
      const fallback = dueDates(wo.priority, wo.reportedAt);
      const respMin = num(r.Response_Minutes), resMin = num(r.Resolve_Minutes);
      wo.responseDueAt = respMin !== undefined ? toGst(ms(wo.reportedAt) + respMin * MINUTE) : fallback.responseDueAt;
      wo.resolveDueAt = resMin !== undefined ? toGst(ms(wo.reportedAt) + resMin * MINUTE) : fallback.resolveDueAt;
    }
    outWos.push(wo);
    ids.workOrder.set(wo.id, r._id);
    keptRefs.add(wo.ref);
  }

  // ---- back-charges (history carries their ref + status) ----
  const bcStatus = new Map<string, BackCharge["status"]>();
  for (const r of register) { const ref = str(r.Back_charge_Ref), st = str(r.Back_charge_Status); if (ref !== undefined && st !== undefined) bcStatus.set(ref, st as BackCharge["status"]); }
  const outBcs = base.backCharges.filter((b) => bcStatus.has(b.ref)).map((b) => ({ ...b, status: bcStatus.get(b.ref) ?? b.status }));

  // ---- snags (board; the ref rides in Snag Location) ----
  const outSnags: Snag[] = [];
  for (const r of snags) {
    const label = str(r.Snag_Location);
    if (label === undefined || isTestItem(label)) continue;
    const ref = label.split(" · ")[0];
    const b = base.snags.find((s) => s.ref === ref);
    if (b === undefined) continue;
    const status = SNAG_BY_NAME[str(r._status_name) ?? ""] ?? b.status;
    outSnags.push({ ...b, status });
    ids.snag.set(b.id, { id: r._id, statusId: str(r._status_id) ?? "" });
  }

  // ---- compliance, PPM, plant, breakdowns (matched on their natural keys) ----
  const outCompliance: ComplianceItem[] = [];
  for (const r of compliance) {
    const b = base.compliance.find((c) => c.certificateNo === str(r.Certificate_No));
    if (b === undefined) continue;
    const item: ComplianceItem = { ...b };
    const exp = isoDate(r.Expires_On); if (exp !== undefined) item.expiresAt = exp;
    const f = num(r.Open_Findings); if (f !== undefined) item.openFindings = f;
    const h = HASSANTUK_FROM_KF[str(r.Hassantuk_Status) ?? ""]; if (h !== undefined) item.hassantukStatus = h;
    outCompliance.push(item);
  }
  const codeOf = (siteId: string) => { const s = base.sites.find((x) => x.id === siteId); return s !== undefined ? s.code : ""; };
  // keep the demo's schedule detail, but take how many assets it covers from Kissflow
  const outPpm: PpmSchedule[] = base.ppm.flatMap((p) => {
    const row = ppm.find((r) => str(r.Schedule_Title) === `${p.title.en} · ${codeOf(p.siteId)}` && r.Active !== false);
    if (row === undefined) return [];
    const count = num(row.Asset_Count);
    return [count !== undefined ? { ...p, assetCount: count } : p];
  });
  const outEquipment: Equipment[] = [];
  for (const r of equipment) {
    const b = base.equipment.find((e) => e.fleetNo === str(r.Fleet_No));
    if (b === undefined) continue;
    const e: Equipment = { ...b };
    const st = EQ_STATUS_FROM_KF[str(r.Equipment_Status) ?? ""]; if (st !== undefined) e.status = st;
    const hrs = num(r.Hour_Meter); if (hrs !== undefined) e.hours = hrs;
    outEquipment.push(e);
  }
  const outBreakdowns: Breakdown[] = base.breakdowns.filter((b) => breakdowns.some((r) => str(r.Reported_At) !== undefined && new Date(str(r.Reported_At) ?? "").getTime() === new Date(b.reportedAt).getTime()));

  // Permits and the handover pack are demo detail Kissflow does not hold; keep only what belongs to a building
  // that was actually loaded, so nothing refers to a building the register no longer has.
  const loadedSiteIds = new Set(outSites.map((s) => s.id));
  const outPermits = base.permits.filter((p) => loadedSiteIds.has(p.siteId));

  const db: Db = {
    ...base,
    permits: outPermits,
    sites: outSites, subcontractors: outSubs, units: outUnits, assets: outAssets, workOrders: outWos, backCharges: outBcs,
    snags: outSnags, compliance: outCompliance, ppm: outPpm, equipment: outEquipment, breakdowns: outBreakdowns
  };
  const counts = { sites: outSites.length, units: outUnits.length, assets: outAssets.length, workOrders: outWos.length, open: outWos.filter((w) => w.status !== "closed").length, backCharges: outBcs.length, snags: outSnags.length, compliance: outCompliance.length, ppm: outPpm.length, equipment: outEquipment.length, breakdowns: outBreakdowns.length };
  return { db, ids, counts };
}
