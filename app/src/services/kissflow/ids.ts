// Kissflow ids and value maps for app CAFM_POC_A00 (built in Phase 4; see BACKEND_CATALOG.md).
// Flow ids never change even though the display names were renamed (e.g. CAFM_WO_Register_A00 = "Work Order History").
import type { Category, Channel, ComplianceItem, Equipment, Liability, PpmSchedule, Priority, SiteKind, SnagStatus, Trade } from "@/domain/types";

export const FLOW = {
  workOrder: "CAFM_Work_Order_A00",
  backCharge: "CAFM_Back_charge_A00",
  permit: "CAFM_Permit_To_Work_A00",
  snag: "CAFM_Snag_A00",
  breakdown: "CAFM_Breakdown_A00",
  site: "CAFM_Site_A00",
  unit: "CAFM_Unit_A00",
  asset: "CAFM_Asset_A00",
  assetClass: "CAFM_Asset_Class_A00",
  category: "CAFM_Request_Category_A00",
  rootCause: "CAFM_Root_Cause_A00",
  subcontractor: "CAFM_Subcontractor_A00",
  compliance: "CAFM_Compliance_Certificate_A00",
  ppm: "CAFM_PPM_Schedule_A00",
  equipment: "CAFM_Equipment_A00",
  register: "CAFM_WO_Register_A00",
  aiConversation: "CAFM_AI_Conversation_A00",
  aiSetting: "CAFM_AI_Setting_A00"
} as const;

/** Work Order step names (as built). */
export const STEP = {
  raised: "Request raised",
  triage: "Triage",
  subDispatch: "Subcontractor dispatch",
  fmDispatch: "FM dispatch",
  engineering: "Engineering review",
  wip: "Work in progress",
  verify: "Verify and close"
} as const;

/** Board status ids (from the caseflow drafts; stable per build). */
export const SNAG_STATUS: Record<SnagStatus, string> = {
  open: "Status_un5as0", in_progress: "Status_f9bl8q", ready_for_inspection: "Status_1mpphh2", carried_to_dlp: "Status_akywxe", closed: "Status_1cv9tq0"
};
export const SNAG_BY_NAME: Record<string, SnagStatus> = {
  "Open": "open", "In progress": "in_progress", "Ready for inspection": "ready_for_inspection", "Carried into DLP": "carried_to_dlp", "Closed": "closed", "Reopened": "open"
};

/** Number codes computed by the Work Order formulas (DATA_MODEL §16). */
export const LIABILITY_BY_CODE: Record<number, Liability> = { 1: "DLP", 2: "CHARGEABLE", 3: "DECENNIAL_REVIEW", 4: "WARRANTY", 5: "OWN_OPS" };
export const PRIORITY_BY_CODE: Record<number, Priority> = { 1: "P1", 2: "P2", 3: "P3", 4: "P4" };

export const CHANNEL_TO_KF: Record<Channel, string> = {
  resident_app: "Resident app", voice_agent: "Voice agent", qr_public: "QR poster", phone: "Phone call", helpdesk: "Helpdesk", ppm: "PPM schedule", email: "Email", whatsapp: "WhatsApp", bms: "BMS alarm"
};
export const CHANNEL_FROM_KF: Record<string, Channel> = Object.fromEntries(Object.entries(CHANNEL_TO_KF).map(([k, v]) => [v, k as Channel]));
export const TRADE_FROM_KF: Record<string, Trade> = { HVAC: "hvac", Lifts: "lifts", Fire: "fire", Electrical: "electrical", Plumbing: "plumbing", Facade: "facade", Finishes: "finishes" };
export const SITE_KIND_FROM_KF: Record<string, SiteKind> = { "Residential tower": "residential_tower", "Site office": "site_office", "Labour accommodation": "labour_accommodation", "Plant yard": "plant_yard" };
export const SITE_KIND_TO_KF: Record<SiteKind, string> = { residential_tower: "Residential tower", site_office: "Site office", labour_accommodation: "Labour accommodation", plant_yard: "Plant yard" };
export const EQ_STATUS_FROM_KF: Record<string, Equipment["status"]> = { Working: "working", Idle: "idle", Breakdown: "breakdown", "In service": "service" };
export const HASSANTUK_FROM_KF: Record<string, NonNullable<ComplianceItem["hassantukStatus"]>> = { Connected: "connected", Fault: "fault" };
export const FREQ_FROM_KF: Record<string, PpmSchedule["frequency"]> = { Monthly: "monthly", Quarterly: "quarterly", "Every 6 months": "semiannual", Annual: "annual" };

/** Kissflow app role name → the frontend's role key. */
export const ROLE_FROM_KF: Record<string, string> = {
  "Admin": "admin", "Executive": "executive", "FM Manager": "fm_manager", "Helpdesk": "helpdesk", "DLP Manager": "dlp_manager", "Subcontractor Supervisor": "subcon_supervisor",
  "Technician": "technician", "Resident": "resident", "Compliance Officer": "compliance", "HSE Officer": "hse", "Plant Manager": "plant_manager"
};

/** Request title in Kissflow carries the frontend ref: "WO-26-04853 · Blocked drain". */
export const titleFor = (ref: string, title: string) => `${ref} · ${title}`;
export const refFromTitle = (t: unknown): string | undefined => {
  if (typeof t !== "string") return undefined;
  const m = /^(WO-\d{2}-\d{5})\s·/.exec(t);
  return m === null ? undefined : m[1];
};
export const isTestItem = (t: unknown) => typeof t === "string" && t.includes("[TEST");
export const categoryKeys: Category[] = ["ac_not_cooling", "ac_noise_leak", "water_leak", "electrical", "lift", "plumbing", "fire_life_safety", "civil_finishes", "doors_hardware", "structural_crack", "ppm"];
