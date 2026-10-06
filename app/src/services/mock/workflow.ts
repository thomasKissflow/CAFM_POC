// Work-order workflow rules shared by the seed generator and the live mock services.
// In Phase 4 these rules map to Kissflow Process steps, conditional branches and SLA settings.
import { classifyLiability } from "@/domain/liability";
import { dueDates, priorityFor } from "@/domain/sla";
import type {
  Asset, BackCharge, Category, Channel, ChecklistItem, Lang, Liability, OrgKind, Photo, RootCause, Site,
  Subcontractor, WoEvent, WoEventType, WorkOrder, Bilingual
} from "@/domain/types";
import { CATEGORY_TRADE, SUBCON_FOR_TRADE } from "./reference";

export interface WorkflowDb {
  sites: Site[];
  assets: Asset[];
  subcontractors: Subcontractor[];
  workOrders: WorkOrder[];
  backCharges: BackCharge[];
  seq: { wo: number; bc: number; ev: number };
}

export interface OpenInput {
  siteId: string;
  unitId?: string;
  assetId?: string;
  category: Category;
  title: Bilingual;
  description: string;
  descriptionLang: Lang;
  channel: Channel;
  reportedBy?: string;
  reporterName?: string;
  reportedAt: string;
  photos?: Photo[];
  story?: boolean;
  transcript?: WorkOrder["transcript"];
  vulnerableOccupant?: boolean;
  accessWindow?: string;
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

export function event(db: WorkflowDb, at: string, actor: string, type: WoEventType, data?: WoEvent["data"], text?: Bilingual): WoEvent {
  db.seq.ev += 1;
  return { id: `EV-${db.seq.ev}`, at, actor, type, data, text };
}

export function checklistFor(category: Category): ChecklistItem[] {
  const items: Record<string, Bilingual[]> = {
    hvac: [
      { en: "Confirm complaint with occupant", ar: "تأكيد البلاغ مع الساكن" },
      { en: "Measure supply-air temperature (°C)", ar: "قياس حرارة هواء الإمداد (°م)" },
      { en: "Check thermostat set-point & mode", ar: "فحص إعدادات منظم الحرارة ووضع التشغيل" },
      { en: "Inspect filter & condensate tray", ar: "فحص الفلتر وصينية التكثيف" },
      { en: "Check CHW valve actuator response", ar: "فحص استجابة مشغل صمام المياه المبردة" },
      { en: "Leave area clean, occupant briefed", ar: "ترك المكان نظيفًا وإبلاغ الساكن" }
    ],
    default: [
      { en: "Confirm complaint with occupant", ar: "تأكيد البلاغ مع الساكن" },
      { en: "Isolate & make safe", ar: "العزل وتأمين الموقع" },
      { en: "Rectify defect", ar: "إصلاح العيب" },
      { en: "Test & verify", ar: "الاختبار والتحقق" },
      { en: "Leave area clean, occupant briefed", ar: "ترك المكان نظيفًا وإبلاغ الساكن" }
    ]
  };
  const trade = CATEGORY_TRADE[category];
  const list = trade === "hvac" ? items.hvac : items.default;
  return list.map((label, i) => ({ id: `CK-${i + 1}`, label, done: false }));
}

/** Routing rule: who owns the job, from the liability decision. */
export function routeFor(liability: Liability, category: Category, asset?: Asset): { org: OrgKind; subcontractorId?: string } {
  if (liability === "DLP" || liability === "WARRANTY") {
    return { org: "subcon", subcontractorId: asset?.installedBy ?? SUBCON_FOR_TRADE[CATEGORY_TRADE[category]] };
  }
  if (liability === "DECENNIAL_REVIEW" || liability === "OWN_OPS") return { org: "dutco" };
  return { org: "fm" };
}

export function openWorkOrder(db: WorkflowDb, input: OpenInput): WorkOrder {
  const site = db.sites.find((s) => s.id === input.siteId);
  if (site === undefined) throw new Error(`Unknown site ${input.siteId}`);
  const asset = input.assetId ? db.assets.find((a) => a.id === input.assetId) : undefined;
  const sub = asset ? db.subcontractors.find((s) => s.id === asset.installedBy) : undefined;
  const { priority, summerUplift } = priorityFor(input.category, input.reportedAt);
  const due = dueDates(priority, input.reportedAt);
  const lia = classifyLiability({ site, asset, category: input.category, reportedAt: input.reportedAt, subcontractorName: sub?.name });
  const route = routeFor(lia.liability, input.category, asset);
  db.seq.wo += 1;
  const id = `WO-${pad(db.seq.wo, 5)}`;
  const wo: WorkOrder = {
    id,
    ref: `WO-26-${pad(db.seq.wo, 5)}`,
    siteId: input.siteId,
    unitId: input.unitId,
    assetId: input.assetId,
    category: input.category,
    title: input.title,
    description: input.description,
    descriptionLang: input.descriptionLang,
    channel: input.channel,
    reportedBy: input.reportedBy,
    reporterName: input.reporterName,
    reportedAt: input.reportedAt,
    priority,
    summerUplift,
    liability: lia.liability,
    liabilityReason: lia.reason,
    status: "assigned",
    assigneeOrg: route.org,
    subcontractorId: route.subcontractorId,
    responseDueAt: due.responseDueAt,
    resolveDueAt: due.resolveDueAt,
    checklist: checklistFor(input.category),
    photos: input.photos ?? [],
    events: [],
    transcript: input.transcript,
    vulnerableOccupant: input.vulnerableOccupant,
    accessWindow: input.accessWindow,
    story: input.story
  };
  wo.events.push(event(db, input.reportedAt, input.reportedBy ?? "system", "created", { channel: input.channel }));
  wo.events.push(event(db, input.reportedAt, "system", "priority_set", { priority, summerUplift }));
  wo.events.push(event(db, input.reportedAt, "system", "liability_flagged", { liability: lia.liability, days: lia.dlpDaysRemaining ?? -1 }, lia.reason));
  wo.events.push(event(db, input.reportedAt, "system", "assigned", { org: route.org, subcontractorId: route.subcontractorId ?? "" }));
  db.workOrders.unshift(wo);
  return wo;
}

export function acceptWorkOrder(db: WorkflowDb, wo: WorkOrder, at: string, actor: string, technicianId?: string) {
  wo.status = "accepted";
  wo.respondedAt = at;
  wo.technicianId = technicianId ?? wo.technicianId;
  wo.events.push(event(db, at, actor, "accepted", { technicianId: wo.technicianId ?? "" }));
}

export function startWorkOrder(db: WorkflowDb, wo: WorkOrder, at: string, actor: string) {
  wo.status = "in_progress";
  wo.events.push(event(db, at, actor, "started"));
}

export interface ResolveInput {
  rootCause: RootCause;
  partsAed: number;
  labourAed: number;
  signature?: string;
  note?: string;
  challengeShown?: boolean;
}

/** Close-out: re-runs the liability engine with the root cause, which may reclassify the job. */
export function resolveWorkOrder(db: WorkflowDb, wo: WorkOrder, at: string, actor: string, input: ResolveInput): { reclassified: boolean } {
  const site = db.sites.find((s) => s.id === wo.siteId);
  if (site === undefined) throw new Error("site missing");
  const asset = wo.assetId ? db.assets.find((a) => a.id === wo.assetId) : undefined;
  const sub = asset ? db.subcontractors.find((s) => s.id === asset.installedBy) : undefined;
  wo.rootCause = input.rootCause;
  wo.partsAed = input.partsAed;
  wo.labourAed = input.labourAed;
  wo.signature = input.signature ?? wo.signature;
  wo.checklist = wo.checklist.map((c) => ({ ...c, done: true }));
  wo.events.push(event(db, at, actor, "root_cause", { rootCause: input.rootCause }, input.note ? { en: input.note, ar: input.note } : undefined));
  const lia = classifyLiability({ site, asset, category: wo.category, reportedAt: wo.reportedAt, rootCause: input.rootCause, subcontractorName: sub?.name });
  let reclassified = false;
  if (lia.liability !== wo.liability) {
    reclassified = true;
    wo.events.push(event(db, at, "system", "reclassified", { from: wo.liability, to: lia.liability }, lia.reason));
    wo.liability = lia.liability;
    wo.liabilityReason = lia.reason;
    const route = routeFor(lia.liability, wo.category, asset);
    wo.assigneeOrg = route.org;
    wo.subcontractorId = route.subcontractorId;
  }
  if (input.signature) wo.events.push(event(db, at, actor, "signed"));
  wo.status = "resolved";
  wo.resolvedAt = at;
  wo.events.push(event(db, at, actor, "resolved", { parts: input.partsAed, labour: input.labourAed }));
  return { reclassified };
}

export function closeWorkOrder(db: WorkflowDb, wo: WorkOrder, at: string, actor: string) {
  wo.status = "closed";
  wo.closedAt = at;
  wo.events.push(event(db, at, actor, "verified"));
  wo.events.push(event(db, at, actor, "closed"));
  if (wo.liability === "DLP" && wo.subcontractorId && wo.rootCause && !wo.backChargeId) {
    db.seq.bc += 1;
    const bc: BackCharge = {
      id: `BC-${pad(db.seq.bc, 4)}`,
      ref: `BC-26-${pad(db.seq.bc, 4)}`,
      workOrderId: wo.id,
      subcontractorId: wo.subcontractorId,
      siteId: wo.siteId,
      partsAed: wo.partsAed ?? 0,
      labourAed: wo.labourAed ?? 0,
      status: "issued",
      issuedAt: at,
      rootCause: wo.rootCause
    };
    db.backCharges.unshift(bc);
    wo.backChargeId = bc.id;
    wo.events.push(event(db, at, "system", "backcharge_created", { backChargeId: bc.id, ref: bc.ref, amount: bc.partsAed + bc.labourAed }));
  }
}
