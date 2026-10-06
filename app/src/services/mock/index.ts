// In-memory mock implementation of the service contracts. No network access.
import { readSla } from "@/domain/sla";
import { DAY, HOUR, MINUTE, addMonthsGst, gstParts, monthKeysEndingAt, ms, toGst } from "@/domain/time";
import { DLP_EXCLUDED } from "@/domain/liability";
import { memoryAiSettings } from "@/services/kissflow/aiSettings";
import type { Asset, BackCharge, ComplianceItem, HandoverPackItem, Photo, Priority, Rag, RootCause, Site, Unit, WorkOrder } from "@/domain/types";
import type {
  AiConversation, BatchAlert, CommandCentre, DiagnosisContext, DlpSummary, MonthlyReport, Services, WorkOrderFilter
} from "../types";
import { buildSeed, type Db } from "./seed";
import { acceptWorkOrder, closeWorkOrder, event, openWorkOrder, resolveWorkOrder } from "./workflow";
import { ASSET_CLASS_META } from "./reference";
import { createMockAi } from "./ai";
import { thermostatPhoto } from "./photos";

/** What a contractor owes at handover. A building added in the app starts with all of it outstanding. */
const HANDOVER_PACK: HandoverPackItem[] = [
  { id: "HP-1", label: { en: "As-built drawings", ar: "المخططات النهائية المنفذة" }, received: false },
  { id: "HP-2", label: { en: "O&M manuals", ar: "أدلة التشغيل والصيانة" }, received: false },
  { id: "HP-3", label: { en: "Warranties & guarantees", ar: "الضمانات والكفالات" }, received: false },
  { id: "HP-4", label: { en: "Testing & commissioning certificates", ar: "شهادات الاختبار والتشغيل" }, received: false },
  { id: "HP-5", label: { en: "Asset register import", ar: "استيراد سجل الأصول" }, received: false, count: 0 },
  { id: "HP-6", label: { en: "Civil Defence completion certificate", ar: "شهادة إنجاز الدفاع المدني" }, received: false },
  { id: "HP-7", label: { en: "Training records (FM team)", ar: "سجلات تدريب فريق المرافق" }, received: false },
  { id: "HP-8", label: { en: "Spare parts & attic stock", ar: "قطع الغيار والمخزون الاحتياطي" }, received: false }
];

const latency = (msec = 120) => new Promise((r) => setTimeout(r, msec));
const clone = <T,>(v: T): T => structuredClone(v);
const OPEN: WorkOrder["status"][] = ["new", "assigned", "accepted", "in_progress", "on_hold"];
export const isOpen = (w: WorkOrder) => OPEN.includes(w.status);

/** `initial` lets the Kissflow adapter run the same services over data loaded from Kissflow. */
export function createMockServices(initial?: Db): Services {
  let db: Db = initial ?? buildSeed();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  // ---- clock -------------------------------------------------------------------------------
  // the real clock: a request raised during a demo is stamped now (the demo data is moved to today instead,
  // see domain/demoTime.ts). `offset` still lets the guided demo jump forwards.
  let offset = 0;
  const now = () => Date.now() + offset;
  // fixed for this session, so "raised in this session" still works after the guided demo jumps the clock
  const sessionStart = Date.now();

  const findWo = (id: string) => {
    const wo = db.workOrders.find((w) => w.id === id);
    if (wo === undefined) throw new Error(`Work order ${id} not found`);
    return wo;
  };

  const complianceRag = (item: ComplianceItem, at: number): Rag => {
    const left = ms(item.expiresAt) - at;
    if (left < 0 || item.openFindings >= 2) return "red";
    if (left < 30 * DAY || item.openFindings > 0 || item.hassantukStatus === "fault") return "amber";
    return "green";
  };

  const diagnosis = (assetId: string, asOf?: string): DiagnosisContext | undefined => {
    const asset = db.assets.find((a) => a.id === assetId);
    if (asset === undefined) return undefined;
    const at = asOf ? ms(asOf) : now();
    const windowDays = 60;
    const prev = db.workOrders
      .filter((w) => w.assetId === assetId && ms(w.reportedAt) >= at - windowDays * DAY && ms(w.reportedAt) < at - MINUTE && w.status !== "cancelled")
      .sort((a, b) => ms(b.reportedAt) - ms(a.reportedAt));
    const siblings = asset.batch
      ? db.workOrders.filter((w) => {
          if (w.assetId === assetId || w.rootCause === undefined || DLP_EXCLUDED.has(w.rootCause)) return false;
          const a = db.assets.find((x) => x.id === w.assetId);
          return a !== undefined && a.batch === asset.batch && a.siteId === asset.siteId && ms(w.reportedAt) >= at - 45 * DAY && w.rootCause === "actuator_failed";
        })
      : [];
    return {
      asset: clone(asset),
      windowDays,
      repeatCount: prev.length + 1,
      previous: prev.map((w) => ({
        workOrderId: w.id, ref: w.ref, at: w.reportedAt, rootCause: w.rootCause, liability: w.liability,
        note: w.events.find((e) => e.type === "root_cause")?.text?.en
      })),
      batch: asset.batch,
      siblingFailures: siblings.map((w) => ({
        assetId: w.assetId!, tag: db.assets.find((a) => a.id === w.assetId)!.tag, at: w.reportedAt, rootCause: w.rootCause!, ref: w.ref
      }))
    };
  };

  const dlpSummary = (): DlpSummary => {
    const sum = (b: BackCharge) => b.partsAed + b.labourAed;
    const recovered = db.backCharges.filter((b) => b.status === "recovered");
    const pending = db.backCharges.filter((b) => b.status === "issued" || b.status === "accepted");
    const disputed = db.backCharges.filter((b) => b.status === "disputed");
    const openDlp = db.workOrders.filter((w) => w.liability === "DLP" && isOpen(w));
    const months = monthKeysEndingAt(now(), 6);
    return {
      recoveredYtdAed: recovered.filter((b) => (b.recoveredAt ?? "").startsWith(String(gstParts(now()).year))).reduce((s, b) => s + sum(b), 0),
      pendingRecoveryAed: pending.reduce((s, b) => s + sum(b), 0),
      disputedAed: disputed.reduce((s, b) => s + sum(b), 0),
      openDlpJobs: openDlp.length,
      openDlpEstimateAed: openDlp.length * 780,
      bySubcontractor: db.subcontractors
        .map((sc) => {
          const bcs = db.backCharges.filter((b) => b.subcontractorId === sc.id);
          return {
            subcontractorId: sc.id,
            jobs: db.workOrders.filter((w) => w.liability === "DLP" && w.subcontractorId === sc.id).length,
            recoveredAed: bcs.filter((b) => b.status === "recovered").reduce((s, b) => s + sum(b), 0),
            pendingAed: bcs.filter((b) => b.status !== "recovered").reduce((s, b) => s + sum(b), 0)
          };
        })
        .filter((r) => r.jobs > 0)
        .sort((a, b) => b.recoveredAed + b.pendingAed - (a.recoveredAed + a.pendingAed)),
      byMonth: months.map((m) => ({
        month: m,
        recoveredAed: recovered.filter((b) => (b.recoveredAt ?? "").startsWith(m)).reduce((s, b) => s + sum(b), 0),
        dlpJobs: db.workOrders.filter((w) => w.reportedAt.startsWith(m) && w.liability === "DLP").length,
        chargeableJobs: db.workOrders.filter((w) => w.reportedAt.startsWith(m) && w.liability === "CHARGEABLE").length
      }))
    };
  };

  const batchAlerts = (): BatchAlert[] => {
    const at = now();
    const groups = new Map<string, WorkOrder[]>();
    for (const w of db.workOrders) {
      if (w.rootCause !== "actuator_failed" || ms(w.reportedAt) < at - 30 * DAY || w.assetId === undefined) continue;
      const a = db.assets.find((x) => x.id === w.assetId);
      if (a?.batch === undefined) continue;
      const key = `${a.siteId}|${a.batch}`;
      groups.set(key, [...(groups.get(key) ?? []), w]);
    }
    return [...groups.entries()]
      .filter(([, list]) => list.length >= 2)
      .map(([key, list]) => {
        const [siteId, batch] = key.split("|");
        const assets = list.map((w) => db.assets.find((a) => a.id === w.assetId)!);
        const floors = assets.map((a) => a.floor);
        return {
          batch, siteId, subcontractorId: assets[0].installedBy, rootCause: "actuator_failed" as RootCause,
          count: list.length, windowDays: 30, assetTags: assets.map((a) => a.tag),
          floors: [Math.min(...floors), Math.max(...floors)] as [number, number]
        };
      });
  };

  const slaFor = (list: WorkOrder[]) => {
    const done = list.filter((w) => w.resolvedAt);
    const met = done.filter((w) => ms(w.resolvedAt!) <= ms(w.resolveDueAt)).length;
    const responded = list.filter((w) => w.respondedAt);
    const rMet = responded.filter((w) => ms(w.respondedAt!) <= ms(w.responseDueAt)).length;
    return {
      met, total: done.length, pct: done.length ? Math.round((met / done.length) * 1000) / 10 : 100,
      responseMetPct: responded.length ? Math.round((rMet / responded.length) * 1000) / 10 : 100
    };
  };

  const ai = createMockAi({
    getDb: () => db,
    now,
    diagnosis,
    dlpSummary,
    complianceRag
  });

  // ---- AI conversations (in memory on demo data) -------------------------------------------
  let conversations: AiConversation[] = [];
  const conversationService: Services["conversations"] = {
    async list() { return clone(conversations); },
    async save(c) { const row: AiConversation = { ...c, id: `AIC-${conversations.length + 1}-${Date.now().toString(36)}` }; conversations = [row, ...conversations]; notify(); return clone(row); },
    async update(id, patch) {
      const i = conversations.findIndex((c) => c.id === id);
      if (i < 0) throw new Error(`Conversation ${id} not found`);
      conversations[i] = { ...conversations[i], ...patch }; notify(); return clone(conversations[i]);
    }
  };

  const services: Services = {
    conversations: conversationService,
    aiSettings: memoryAiSettings(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clock: {
      now,
      advance(delta) {
        offset += delta;
        notify();
      },
      reset() {
        offset = 0;
        notify();
      }
    },
    directory: {
      async sites() { return clone(db.sites); },
      // apartments read in building order, whatever order Kissflow returned them in
      async units(siteId) {
        return clone(db.units.filter((u) => u.siteId === siteId).sort((a, b) => (a.floor - b.floor) || a.number.localeCompare(b.number, "en", { numeric: true })));
      },
      async people() { return clone(db.people); },
      async subcontractors() { return clone(db.subcontractors); }
    },
    estate: {
      persists: false,
      async addProperty(input, onProgress) {
        const code = input.site.code.trim().toUpperCase();
        if (code === "") throw new Error("a building needs a code");
        if (db.sites.some((x) => x.code === code)) throw new Error(`${code} is already a building here`);
        const site: Site = { ...input.site, code, id: `S-${code}` };
        const units: Unit[] = input.units.map((u) => ({ id: `U-${code}-${u.number}`, siteId: site.id, number: u.number, floor: u.floor }));
        const byNumber = new Map(units.map((u) => [u.number, u]));
        const assets: Asset[] = input.assets.map((a) => {
          const meta = ASSET_CLASS_META[a.assetClass];
          const unit = a.unitNumber !== undefined ? byNumber.get(a.unitNumber) : undefined;
          const asset: Asset = {
            id: `A-${code}-${a.tag}`, tag: a.tag, qrCode: `TSL:${code}:${a.tag}`, siteId: site.id, floor: a.floor, location: a.location,
            assetClass: a.assetClass, trade: meta.trade, make: meta.make, model: meta.model, serial: `${a.tag}-${code}`,
            installedBy: a.installedBy !== undefined ? a.installedBy : "", status: "operational"
          };
          if (unit !== undefined) asset.unitId = unit.id;
          if (a.handoverDate !== undefined) {
            asset.handoverDate = a.handoverDate;
            asset.warrantyEnd = addMonthsGst(a.handoverDate, meta.warrantyMonths);
            if (input.site.dlpMonths !== undefined) asset.dlpEnd = toGst(ms(addMonthsGst(a.handoverDate, input.site.dlpMonths)) - 1000);
          }
          return asset;
        });
        db.sites.push(site);
        db.units.push(...units);
        db.assets.push(...assets);
        // a tower just handed over owes its documents: the pack starts outstanding, bar the register we just imported
        db.handoverPack[site.id] = HANDOVER_PACK.map((item) =>
          item.id === "HP-5" && assets.length > 0
            ? { ...item, received: true, receivedAt: toGst(now()), count: assets.length }
            : { ...item });
        if (onProgress !== undefined) onProgress(1 + units.length + assets.length, 1 + units.length + assets.length);
        notify();
        return { site: clone(site), units: clone(units), assets: clone(assets) };
      },
      async removeProperty(siteId) {
        const site = db.sites.find((x) => x.id === siteId);
        if (site === undefined) throw new Error("that building is not in the estate");
        const jobs = db.workOrders.filter((w) => w.siteId === siteId).length;
        if (jobs > 0) throw new Error(`${site.name.en} has ${jobs} work order${jobs === 1 ? "" : "s"} against it, so it cannot be removed`);
        db.sites = db.sites.filter((x) => x.id !== siteId);
        db.units = db.units.filter((u) => u.siteId !== siteId);
        db.assets = db.assets.filter((a) => a.siteId !== siteId);
        db.snags = db.snags.filter((x) => x.siteId !== siteId);
        db.compliance = db.compliance.filter((c) => c.siteId !== siteId);
        db.ppm = db.ppm.filter((x) => x.siteId !== siteId);
        db.permits = db.permits.filter((x) => x.siteId !== siteId);
        delete db.handoverPack[siteId];
        notify();
      }
    },
    workOrders: {
      async list(f: WorkOrderFilter = {}) {
        await latency(60);
        let list = db.workOrders;
        if (f.siteId) list = list.filter((w) => w.siteId === f.siteId);
        if (f.open !== undefined) list = list.filter((w) => isOpen(w) === f.open);
        if (f.liability) list = list.filter((w) => w.liability === f.liability);
        if (f.priority) list = list.filter((w) => w.priority === f.priority);
        if (f.technicianId) list = list.filter((w) => w.technicianId === f.technicianId);
        if (f.subcontractorId) list = list.filter((w) => w.subcontractorId === f.subcontractorId);
        if (f.reportedBy) list = list.filter((w) => w.reportedBy === f.reportedBy);
        if (f.assetId) list = list.filter((w) => w.assetId === f.assetId);
        if (f.from) list = list.filter((w) => ms(w.reportedAt) >= ms(f.from!));
        if (f.to) list = list.filter((w) => ms(w.reportedAt) < ms(f.to!));
        if (f.text) {
          const q = f.text.toLowerCase();
          list = list.filter((w) => `${w.ref} ${w.title.en} ${w.title.ar} ${w.description} ${w.reporterName ?? ""}`.toLowerCase().includes(q) ||
            (w.assetId ? db.assets.find((a) => a.id === w.assetId)?.tag.toLowerCase().includes(q) : false));
        }
        return clone(f.limit ? list.slice(0, f.limit) : list);
      },
      async get(id) {
        await latency(40);
        const wo = db.workOrders.find((w) => w.id === id);
        return wo ? clone(wo) : undefined;
      },
      async create(input, actorId) {
        await latency(250);
        const { aiTriage, firstContactAt, ...rest } = input;
        const wo = openWorkOrder(db, {
          ...rest,
          reportedAt: firstContactAt ?? toGst(now()),
          reportedBy: input.reportedBy ?? actorId,
          story: input.assetId === "A-QMR-FCU-1402-01" ? true : undefined
        });
        if (aiTriage) wo.events.splice(1, 0, event(db, wo.reportedAt, "ai", "ai_triage", { category: aiTriage.category, confidence: aiTriage.confidence }));
        notify();
        return clone(wo);
      },
      async accept(id, actorId, technicianId) {
        const wo = findWo(id);
        acceptWorkOrder(db, wo, toGst(now()), actorId, technicianId);
        notify();
        return clone(wo);
      },
      async arrive(id, actorId) {
        const wo = findWo(id);
        wo.status = "in_progress";
        wo.events.push(event(db, toGst(now()), actorId, "arrived"));
        notify();
        return clone(wo);
      },
      async toggleChecklist(id, itemId, actorId) {
        const wo = findWo(id);
        wo.checklist = wo.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
        const item = wo.checklist.find((c) => c.id === itemId);
        if (item?.done) wo.events.push(event(db, toGst(now()), actorId, "checklist", { item: item.label.en }));
        notify();
        return clone(wo);
      },
      async addPhoto(id, photo: Photo, actorId) {
        const wo = findWo(id);
        wo.photos.push(photo);
        wo.events.push(event(db, toGst(now()), actorId, "photo", { kind: photo.kind }));
        notify();
        return clone(wo);
      },
      async recordChallenge(id, actorId, shown) {
        const wo = findWo(id);
        wo.events.push(event(db, toGst(now()), actorId, "diagnosis_challenge", { shown }));
        notify();
        return clone(wo);
      },
      async resolve(id, input, actorId) {
        await latency(300);
        const wo = findWo(id);
        const r = resolveWorkOrder(db, wo, toGst(now()), actorId, input);
        notify();
        return { workOrder: clone(wo), reclassified: r.reclassified };
      },
      async verifyAndClose(id, actorId) {
        await latency(200);
        const wo = findWo(id);
        closeWorkOrder(db, wo, toGst(now()), actorId);
        notify();
        return clone(wo);
      },
      async comment(id, text, actorId) {
        const wo = findWo(id);
        wo.events.push(event(db, toGst(now()), actorId, "comment", undefined, { en: text, ar: text }));
        notify();
        return clone(wo);
      }
    },
    assets: {
      async list(f = {}) {
        await latency(60);
        let list = db.assets;
        if (f.siteId) list = list.filter((a) => a.siteId === f.siteId);
        if (f.assetClass) list = list.filter((a) => a.assetClass === f.assetClass);
        if (f.inDlp !== undefined) list = list.filter((a) => (a.dlpEnd ? ms(a.dlpEnd) >= now() : false) === f.inDlp);
        if (f.text) {
          const q = f.text.toLowerCase();
          list = list.filter((a) => `${a.tag} ${a.location.en} ${a.location.ar} ${a.serial} ${a.batch ?? ""}`.toLowerCase().includes(q));
        }
        return clone(list);
      },
      async get(id) { return clone(db.assets.find((a) => a.id === id)); },
      async byQr(code) {
        await latency(200);
        const c = code.trim();
        return clone(db.assets.find((a) => a.qrCode === c || a.tag.toLowerCase() === c.toLowerCase()));
      },
      async history(assetId) {
        return clone(db.workOrders.filter((w) => w.assetId === assetId).sort((a, b) => ms(b.reportedAt) - ms(a.reportedAt)));
      },
      async diagnosis(assetId, asOf) { return diagnosis(assetId, asOf); }
    },
    dlp: {
      async backCharges(f = {}) {
        let list = db.backCharges;
        if (f.subcontractorId) list = list.filter((b) => b.subcontractorId === f.subcontractorId);
        if (f.status) list = list.filter((b) => b.status === f.status);
        return clone(list);
      },
      async backCharge(id) { return clone(db.backCharges.find((b) => b.id === id)); },
      async summary() { return dlpSummary(); },
      async batchAlerts() { return batchAlerts(); },
      async setBackChargeStatus(id, status) {
        const bc = db.backCharges.find((b) => b.id === id);
        if (bc === undefined) throw new Error("back-charge not found");
        bc.status = status;
        if (status === "recovered") bc.recoveredAt = toGst(now());
        notify();
        return clone(bc);
      }
    },
    handover: {
      async pack(siteId) { return clone(db.handoverPack[siteId] ?? []); },
      async snags(siteId) { return clone(db.snags.filter((s) => s.siteId === siteId)); },
      async moveSnag(id, status) {
        const s = db.snags.find((x) => x.id === id);
        if (s === undefined) throw new Error("snag not found");
        s.status = status;
        notify();
        return clone(s);
      }
    },
    compliance: {
      async items(siteId) { return clone(siteId ? db.compliance.filter((c) => c.siteId === siteId) : db.compliance); },
      rag: complianceRag
    },
    ppm: {
      async schedules(siteId) { return clone(siteId ? db.ppm.filter((p) => p.siteId === siteId) : db.ppm); }
    },
    permits: {
      async list(siteId) { return clone(siteId ? db.permits.filter((p) => p.siteId === siteId) : db.permits); },
      async setStatus(id, status, actorId) {
        const p = db.permits.find((x) => x.id === id);
        if (p === undefined) throw new Error("permit not found");
        p.status = status;
        if (status === "approved") p.approverId = actorId;
        notify();
        return clone(p);
      }
    },
    fleet: {
      async equipment() { return clone(db.equipment); },
      async breakdowns() { return clone(db.breakdowns); }
    },
    reports: {
      async commandCentre(siteIds) {
        await latency(150);
        const at = now();
        const inScope = (w: WorkOrder) => (siteIds && siteIds.length ? siteIds.includes(w.siteId) : true);
        const wos = db.workOrders.filter(inScope);
        const { year, month } = gstParts(at);
        const monthKey = `${year}-${String(month).padStart(2, "0")}`;
        const open = wos.filter(isOpen);
        const openByPriority: Record<Priority, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
        open.forEach((w) => (openByPriority[w.priority] += 1));
        const atRisk = open
          .map((w) => ({ w, r: readSla(w.reportedAt, w.resolveDueAt, at) }))
          .sort((a, b) => a.r.remainingMs - b.r.remainingMs)
          .slice(0, 7)
          .map((x) => x.w);
        const rag: Record<Rag, number> = { green: 0, amber: 0, red: 0 };
        db.compliance.filter((c) => (siteIds && siteIds.length ? siteIds.includes(c.siteId) : true)).forEach((c) => (rag[complianceRag(c, at)] += 1));
        const avail = db.equipment.filter((e) => e.status === "working" || e.status === "idle").length;
        const weekStart = at - 8 * 7 * DAY;
        const acHeat = [] as CommandCentre["acHeat"];
        for (let floor = 30; floor >= 5; floor--) {
          const weeks = Array.from({ length: 8 }, () => 0);
          db.workOrders.forEach((w) => {
            if (w.siteId !== "S-QMR" || (w.category !== "ac_not_cooling" && w.category !== "ac_noise_leak")) return;
            const t = ms(w.reportedAt);
            if (t < weekStart || t > at) return;
            const unit = db.units.find((u) => u.id === w.unitId);
            if (unit?.floor !== floor) return;
            weeks[Math.min(7, Math.floor((t - weekStart) / (7 * DAY)))] += 1;
          });
          acHeat.push({ floor, weeks });
        }
        const months = monthKeysEndingAt(at, 6);
        return {
          asOf: at,
          sla: slaFor(wos.filter((w) => w.reportedAt.startsWith(monthKey))),
          slaTrend: months.map((m) => ({ month: m, pct: slaFor(wos.filter((w) => w.reportedAt.startsWith(m))).pct })),
          openByPriority,
          openTotal: open.length,
          atRisk: clone(atRisk),
          dlp: dlpSummary(),
          complianceRag: rag,
          fleetAvailabilityPct: Math.round((avail / db.equipment.length) * 100),
          fleetDown: db.equipment.length - avail,
          acHeat,
          batchAlerts: batchAlerts()
        };
      },
      async monthly(siteId, month) {
        await latency(200);
        const wos = db.workOrders.filter((w) => w.siteId === siteId && w.reportedAt.startsWith(month));
        const sla = slaFor(wos);
        const count = <K extends string>(key: (w: WorkOrder) => K) => {
          const m = new Map<K, number>();
          wos.forEach((w) => m.set(key(w), (m.get(key(w)) ?? 0) + 1));
          return [...m.entries()].sort((a, b) => b[1] - a[1]);
        };
        const visits = db.ppm.filter((p) => p.siteId === siteId).flatMap((p) => p.visits.filter((v) => v.due.startsWith(month)));
        const report: MonthlyReport = {
          siteId, month,
          totals: {
            raised: wos.length,
            closed: wos.filter((w) => w.status === "closed").length,
            slaPct: sla.pct,
            responsePct: sla.responseMetPct,
            dlpJobs: wos.filter((w) => w.liability === "DLP").length,
            chargeableJobs: wos.filter((w) => w.liability === "CHARGEABLE").length,
            recoveredAed: db.backCharges.filter((b) => b.siteId === siteId && (b.recoveredAt ?? "").startsWith(month)).reduce((s, b) => s + b.partsAed + b.labourAed, 0)
          },
          byCategory: count((w) => w.category).map(([category, c]) => ({ category, count: c })),
          byChannel: count((w) => w.channel).map(([channel, c]) => ({ channel, count: c })),
          ppm: { due: visits.length, done: visits.filter((v) => v.doneAt).length, pct: visits.length ? Math.round((visits.filter((v) => v.doneAt).length / visits.length) * 100) : 100 },
          compliance: clone(db.compliance.filter((c) => c.siteId === siteId)),
          breaches: clone(wos.filter((w) => w.resolvedAt ? ms(w.resolvedAt) > ms(w.resolveDueAt) : ms(w.resolveDueAt) < now())),
          eventsLogged: wos.reduce((s, w) => s + w.events.length, 0)
        };
        return report;
      }
    },
    ai,
    demo: {
      async chat() { return clone(db.chat); },
      reset() {
        db = buildSeed();
        offset = 0;
        notify();
      },
      storyWorkOrderId() {
        return db.workOrders.find((w) => w.assetId === "A-QMR-FCU-1402-01" && ms(w.reportedAt) >= sessionStart - HOUR)?.id;
      },
      async runStoryStep(step) {
        const t = now();
        const storyId = services.demo.storyWorkOrderId();
        if (step === "raise") {
          if (storyId === undefined) {
          const wo = openWorkOrder(db, {
            siteId: "S-QMR", unitId: "U-QMR-1402", assetId: "A-QMR-FCU-1402-01", category: "ac_not_cooling",
            title: { en: "AC not cooling", ar: "المكيف لا يبرد" },
            description: "المكيف لا يبرد أبدًا منذ الصباح، والحرارة داخل الشقة ٢٩ درجة. عندي طفل صغير، أرجو الإسراع.",
            descriptionLang: "ar", channel: "resident_app", reportedBy: "P-LAYLA", reporterName: "ليلى السويدي",
            reportedAt: toGst(t), story: true,
            photos: [{ id: "PH-story-1", url: thermostatPhoto(29), kind: "report", takenAt: toGst(t), caption: "Thermostat 29°C" }]
          });
          wo.events.splice(1, 0, event(db, toGst(t + 2000), "ai", "ai_triage", { category: "ac_not_cooling", confidence: 0.94 }));
          }
          const id = services.demo.storyWorkOrderId()!;
          const storyAt = ms(db.workOrders.find((w) => w.id === id)!.reportedAt);
          if (db.workOrders.some((w) => w.channel === "qr_public" && ms(w.reportedAt) >= sessionStart - HOUR)) return id;
          // a neighbour on the QR channel: any other apartment FCU in the building that is actually in the register
          const storyWo = db.workOrders.find((w) => w.id === id);
          const neighbourFcu = db.assets.find((a) => a.siteId === "S-QMR" && a.assetClass === "FCU" && a.unitId !== undefined && a.id !== storyWo?.assetId);
          openWorkOrder(db, {
            siteId: "S-QMR", unitId: neighbourFcu?.unitId, assetId: neighbourFcu?.id, category: "ac_noise_leak",
            title: { en: "AC dripping water", ar: "المكيف يسرب ماء" }, description: "Water dripping from the AC grille onto the sofa.",
            descriptionLang: "en", channel: "qr_public", reporterName: "Priya Sharma", reportedAt: toGst(storyAt - 3 * MINUTE)
          });
          openWorkOrder(db, {
            siteId: "S-QMR", assetId: "A-QMR-LIFT-B", category: "lift",
            title: { en: "Lift door not closing", ar: "باب المصعد لا يغلق" }, description: "Caller: lift B door reopens repeatedly at level 9.",
            descriptionLang: "en", channel: "phone", reporterName: "Omar Khalil", reportedAt: toGst(storyAt - 1 * MINUTE)
          });
          notify();
          return id;
        }
        if (storyId === undefined) return undefined;
        const wo = findWo(storyId);
        if (step === "accept" && wo.status === "assigned") {
          const target = ms(wo.reportedAt) + 42 * MINUTE;
          if (t < target) offset += target - t;
          acceptWorkOrder(db, wo, toGst(now()), "P-RASHID", "P-JOEL");
        }
        if ((step === "resolve_dlp" || step === "resolve_chargeable") && (wo.status === "accepted" || wo.status === "in_progress")) {
          const target = ms(wo.reportedAt) + 5 * HOUR + 12 * MINUTE;
          if (now() < target) offset += target - now();
          resolveWorkOrder(db, wo, toGst(now()), "P-JOEL", step === "resolve_dlp"
            ? { rootCause: "actuator_failed", partsAed: 1450, labourAed: 600, signature: "demo", note: "CHW control valve actuator failed (no stroke); replaced like-for-like." }
            : { rootCause: "filter_clogged", partsAed: 90, labourAed: 180, signature: "demo", note: "Filter heavily clogged; cleaned and replaced." });
        }
        if (step === "close" && wo.status === "resolved") {
          offset += 25 * MINUTE;
          closeWorkOrder(db, wo, toGst(now()), "P-ARJUN");
        }
        notify();
        return wo.id;
      }
    }
  };
  return services;
}
