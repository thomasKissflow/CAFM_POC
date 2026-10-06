// Domain model for the CAFM demo. These types are the contract between screens and the
// service layer; the Kissflow-backed adapter (Phase 6) must return the same shapes.

export type Lang = "en" | "ar";
export interface Bilingual {
  en: string;
  ar: string;
}
export type ISODate = string; // ISO-8601 with offset, e.g. 2026-08-18T14:05:00+04:00

export type RoleKey =
  | "executive"
  | "fm_manager"
  | "helpdesk"
  | "dlp_manager"
  | "subcon_supervisor"
  | "technician"
  | "resident"
  | "compliance"
  | "hse"
  | "plant_manager"
  | "admin";

export type OrgKind = "dutco" | "fm" | "subcon" | "tenant";

export interface Person {
  id: string;
  name: Bilingual;
  role: RoleKey;
  org: OrgKind;
  title: Bilingual;
  subcontractorId?: string;
  unitId?: string;
  siteIds: string[];
}

export type SiteKind = "residential_tower" | "site_office" | "labour_accommodation" | "plant_yard";

export interface Site {
  id: string;
  code: string;
  name: Bilingual;
  district: Bilingual;
  kind: SiteKind;
  client: Bilingual;
  /** Dutco's own facility (site office, camp, yard) rather than a handed-over client building. */
  ownOperations: boolean;
  tocDate?: ISODate;
  dlpMonths?: number;
  floors?: number;
  unitCount?: number;
  beds?: number;
}

export interface Unit {
  id: string;
  siteId: string;
  floor: number;
  number: string;
  residentId?: string;
}

export type Trade = "hvac" | "lifts" | "fire" | "electrical" | "plumbing" | "facade" | "finishes";

export type AssetClass =
  | "FCU"
  | "SPLIT_AC"
  | "CHW_PUMP"
  | "ETS"
  | "LIFT"
  | "FIRE_PUMP"
  | "SPRINKLER_ZONE"
  | "FIRE_ALARM_PANEL"
  | "EMERGENCY_LIGHTING"
  | "DG_SET"
  | "WATER_TANK"
  | "BOOSTER_PUMP"
  | "LV_PANEL";

export type AssetStatus = "operational" | "degraded" | "down";

export interface Asset {
  id: string;
  tag: string;
  qrCode: string;
  siteId: string;
  unitId?: string;
  floor: number;
  location: Bilingual;
  assetClass: AssetClass;
  trade: Trade;
  make: string;
  model: string;
  serial: string;
  installedBy: string; // subcontractor id
  batch?: string;
  handoverDate?: ISODate;
  dlpEnd?: ISODate;
  warrantyEnd?: ISODate;
  decennialEnd?: ISODate;
  status: AssetStatus;
}

export interface Subcontractor {
  id: string;
  name: string;
  nameAr: string;
  trade: Trade;
  tradeLicenceNo: string;
  tradeLicenceExpiry: ISODate;
  insuranceExpiry: ISODate;
  civilDefenceApproved: boolean;
  civilDefenceExpiry?: ISODate;
  supervisorId?: string;
}

export type Priority = "P1" | "P2" | "P3" | "P4";

export type Channel =
  | "resident_app"
  | "voice_agent"
  | "qr_public"
  | "phone"
  | "helpdesk"
  | "ppm"
  | "email"
  | "whatsapp"
  | "bms";

/** Channels that exist as live paths in the demo; the rest are integration-ready tiles only. */
export const LIVE_CHANNELS: Channel[] = ["resident_app", "voice_agent", "qr_public", "phone", "helpdesk", "ppm"];

export type Category =
  | "ac_not_cooling"
  | "ac_noise_leak"
  | "water_leak"
  | "electrical"
  | "lift"
  | "plumbing"
  | "fire_life_safety"
  | "civil_finishes"
  | "doors_hardware"
  | "structural_crack"
  | "ppm";

export type Liability = "DLP" | "CHARGEABLE" | "DECENNIAL_REVIEW" | "WARRANTY" | "OWN_OPS" | "PPM";

export type RootCause =
  | "actuator_failed"
  | "thermostat_fault"
  | "filter_clogged"
  | "condensate_blocked"
  | "refrigerant_leak"
  | "chw_low_flow"
  | "fan_motor_failed"
  | "pipe_joint_leak"
  | "breaker_tripped"
  | "door_operator_fault"
  | "sealant_failure"
  | "workmanship"
  | "misuse"
  | "tenant_damage"
  | "wear_and_tear"
  | "consumable"
  | "planned_service";

export type WoStatus =
  | "new"
  | "assigned"
  | "accepted"
  | "in_progress"
  | "on_hold"
  | "resolved"
  | "closed"
  | "cancelled";

export type WoEventType =
  | "created"
  | "ai_triage"
  | "priority_set"
  | "liability_flagged"
  | "assigned"
  | "accepted"
  | "started"
  | "arrived"
  | "checklist"
  | "photo"
  | "diagnosis_challenge"
  | "root_cause"
  | "reclassified"
  | "resolved"
  | "signed"
  | "verified"
  | "closed"
  | "comment"
  | "sla_warning"
  | "sla_breach"
  | "backcharge_created"
  | "permit_linked";

export interface WoEvent {
  id: string;
  at: ISODate;
  /** person id, or "system" for engine actions, or "ai" for AI-preview suggestions */
  actor: string;
  type: WoEventType;
  text?: Bilingual;
  data?: Record<string, string | number | boolean>;
}

export interface ChecklistItem {
  id: string;
  label: Bilingual;
  done: boolean;
  reading?: string;
}

export interface Photo {
  id: string;
  url: string;
  kind: "before" | "after" | "report";
  takenAt: ISODate;
  caption?: string;
}

export interface WorkOrder {
  id: string;
  ref: string;
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
  /** First contact: the SLA clock starts here, not at data entry. */
  reportedAt: ISODate;
  priority: Priority;
  summerUplift: boolean;
  liability: Liability;
  liabilityReason: Bilingual;
  status: WoStatus;
  assigneeOrg: OrgKind;
  subcontractorId?: string;
  technicianId?: string;
  responseDueAt: ISODate;
  resolveDueAt: ISODate;
  respondedAt?: ISODate;
  resolvedAt?: ISODate;
  closedAt?: ISODate;
  rootCause?: RootCause;
  checklist: ChecklistItem[];
  photos: Photo[];
  signature?: string;
  partsAed?: number;
  labourAed?: number;
  backChargeId?: string;
  permitId?: string;
  events: WoEvent[];
  /** Voice-agent conversation that produced this request (voice_agent channel). */
  transcript?: TranscriptLine[];
  vulnerableOccupant?: boolean;
  accessWindow?: string;
  story?: boolean;
}

export interface TranscriptLine {
  role: "caller" | "agent";
  text: string;
  at: ISODate;
  interrupted?: boolean;
}

export type BackChargeStatus = "issued" | "accepted" | "disputed" | "recovered";

export interface BackCharge {
  id: string;
  ref: string;
  workOrderId: string;
  subcontractorId: string;
  siteId: string;
  partsAed: number;
  labourAed: number;
  status: BackChargeStatus;
  issuedAt: ISODate;
  recoveredAt?: ISODate;
  rootCause: RootCause;
}

export type SnagStatus = "open" | "in_progress" | "ready_for_inspection" | "closed" | "carried_to_dlp";

export interface Snag {
  id: string;
  ref: string;
  siteId: string;
  unitId?: string;
  location: Bilingual;
  title: Bilingual;
  trade: Trade;
  subcontractorId: string;
  status: SnagStatus;
  raisedAt: ISODate;
}

export interface HandoverPackItem {
  id: string;
  label: Bilingual;
  received: boolean;
  receivedAt?: ISODate;
  count?: number;
}

export type ComplianceSystem =
  | "civil_defence_certificate"
  | "fire_alarm"
  | "sprinklers"
  | "fire_pumps"
  | "emergency_lighting"
  | "extinguishers"
  | "hassantuk"
  | "lifts"
  | "water_tank_cleaning"
  | "lifting_equipment";

export type Rag = "green" | "amber" | "red";

export interface ComplianceItem {
  id: string;
  siteId: string;
  system: ComplianceSystem;
  contractorId?: string;
  certificateNo: string;
  issuedAt: ISODate;
  expiresAt: ISODate;
  lastInspection: ISODate;
  evidenceCount: number;
  openFindings: number;
  hassantukStatus?: "connected" | "fault";
}

export type PpmFrequency = "monthly" | "quarterly" | "semiannual" | "annual";

export interface PpmVisit {
  due: ISODate;
  doneAt?: ISODate;
  evidence: number;
}

export interface PpmSchedule {
  id: string;
  siteId: string;
  assetClass: AssetClass;
  title: Bilingual;
  frequency: PpmFrequency;
  assetCount: number;
  contractorId?: string;
  visits: PpmVisit[];
}

export type PermitType = "hot_work" | "work_at_height" | "electrical_isolation" | "confined_space";
export type PermitStatus = "requested" | "approved" | "active" | "closed" | "rejected";

export interface Permit {
  id: string;
  ref: string;
  type: PermitType;
  siteId: string;
  workOrderId?: string;
  location: Bilingual;
  requesterId: string;
  approverId?: string;
  status: PermitStatus;
  validFrom: ISODate;
  validTo: ISODate;
  controls: Bilingual[];
}

export type EquipmentType =
  | "crawler_crane"
  | "mobile_crane"
  | "tower_crane"
  | "excavator"
  | "wheel_loader"
  | "tipper"
  | "low_bed"
  | "generator"
  | "compressor"
  | "piling_rig";

export type EquipmentStatus = "working" | "idle" | "breakdown" | "service";

export interface Equipment {
  id: string;
  fleetNo: string;
  type: EquipmentType;
  make: string;
  model: string;
  year: number;
  siteId: string;
  projectLabel: Bilingual;
  hours: number;
  nextServiceHours: number;
  /** Third-party inspection certificate for lifting equipment. */
  tpiExpiry?: ISODate;
  status: EquipmentStatus;
}

export interface Breakdown {
  id: string;
  equipmentId: string;
  reportedAt: ISODate;
  description: Bilingual;
  downtimeHours: number;
  open: boolean;
}

export interface ChatMessage {
  id: string;
  at: string; // HH:MM
  author: string;
  kind: "text" | "voice" | "photo" | "system";
  text?: string;
  seconds?: number;
}
