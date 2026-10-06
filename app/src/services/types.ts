// Service contracts. Screens depend ONLY on these interfaces (via useServices()).
// Phase 2 ships a mock implementation; Phase 6 swaps in a Kissflow-backed one
// (kf.app.getProcess/getDataform/getBoard, kf.api, kf.user.AppRoles) without touching screens.
import type {
  Asset, AssetClass, BackCharge, Bilingual, Breakdown, Category, Channel, ChatMessage, ComplianceItem, Equipment,
  HandoverPackItem, ISODate, Lang, Liability, Permit, Person, Photo, PpmSchedule, Priority, Rag, RootCause,
  Site, Snag, SnagStatus, Subcontractor, TranscriptLine, Unit, WorkOrder
} from "@/domain/types";

export interface ClockService {
  /** Current demo time (epoch ms). Runs in real time from the demo anchor. */
  now(): number;
  /** Jump the demo clock forward (guided demo beats). */
  advance(ms: number): void;
  reset(): void;
}

export interface DirectoryService {
  sites(): Promise<Site[]>;
  units(siteId: string): Promise<Unit[]>;
  people(): Promise<Person[]>;
  subcontractors(): Promise<Subcontractor[]>;
}

export interface NewSiteInput {
  /** Short code the whole estate joins on: QMR, JDP. Upper case, letters and digits. */
  code: string;
  name: Bilingual;
  district: Bilingual;
  kind: Site["kind"];
  client: Bilingual;
  ownOperations: boolean;
  /** Taking-over certificate. With DLP months it drives the whole defects-liability clock. */
  tocDate?: ISODate;
  dlpMonths?: number;
  floors?: number;
  unitCount?: number;
  beds?: number;
}

export interface NewUnitInput { number: string; floor: number }

export interface NewAssetInput {
  tag: string;
  assetClass: AssetClass;
  floor: number;
  location: Bilingual;
  /** The apartment this sits in, by number, when it is an in-unit asset such as a fan coil. */
  unitNumber?: string;
  installedBy?: string;
  handoverDate?: ISODate;
}

export interface AddedProperty { site: Site; units: Unit[]; assets: Asset[] }

export interface EstateService {
  /** Adds a building, its apartments and its assets. `onProgress` reports each row as it is written. */
  addProperty(
    input: { site: NewSiteInput; units: NewUnitInput[]; assets: NewAssetInput[] },
    onProgress?: (done: number, total: number) => void
  ): Promise<AddedProperty>;
  /** Removes a building and everything under it. Refuses while work orders still reference it. */
  removeProperty(siteId: string): Promise<void>;
  /** False for the offline demo: a building added there lives only until the tab is reloaded. */
  persists: boolean;
}

export interface WorkOrderFilter {
  siteId?: string;
  open?: boolean;
  liability?: Liability;
  priority?: Priority;
  technicianId?: string;
  subcontractorId?: string;
  reportedBy?: string;
  assetId?: string;
  text?: string;
  from?: ISODate;
  to?: ISODate;
  limit?: number;
}

export interface NewRequestInput {
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
  /** First-contact time (e.g. when the phone call was received). Defaults to now. */
  firstContactAt?: ISODate;
  photos?: Photo[];
  /** Recorded in the activity log when the AI-preview triage was accepted. */
  aiTriage?: { category: Category; confidence: number };
  transcript?: TranscriptLine[];
  vulnerableOccupant?: boolean;
  accessWindow?: string;
}

export interface CloseoutInput {
  rootCause: RootCause;
  partsAed: number;
  labourAed: number;
  signature?: string;
  note?: string;
  challengeAcknowledged: boolean;
}

export interface WorkOrderService {
  list(filter?: WorkOrderFilter): Promise<WorkOrder[]>;
  get(id: string): Promise<WorkOrder | undefined>;
  create(input: NewRequestInput, actorId: string): Promise<WorkOrder>;
  accept(id: string, actorId: string, technicianId: string): Promise<WorkOrder>;
  arrive(id: string, actorId: string): Promise<WorkOrder>;
  toggleChecklist(id: string, itemId: string, actorId: string): Promise<WorkOrder>;
  addPhoto(id: string, photo: Photo, actorId: string): Promise<WorkOrder>;
  recordChallenge(id: string, actorId: string, shown: string): Promise<WorkOrder>;
  resolve(id: string, input: CloseoutInput, actorId: string): Promise<{ workOrder: WorkOrder; reclassified: boolean }>;
  verifyAndClose(id: string, actorId: string): Promise<WorkOrder>;
  comment(id: string, text: string, actorId: string): Promise<WorkOrder>;
}

export interface DiagnosisContext {
  asset: Asset;
  windowDays: number;
  repeatCount: number;
  previous: Array<{ workOrderId: string; ref: string; at: ISODate; rootCause?: RootCause; note?: string; liability: Liability }>;
  batch?: string;
  siblingFailures: Array<{ assetId: string; tag: string; at: ISODate; rootCause: RootCause; ref: string }>;
}

export interface AssetFilter {
  siteId?: string;
  assetClass?: string;
  text?: string;
  inDlp?: boolean;
}

export interface AssetService {
  list(filter?: AssetFilter): Promise<Asset[]>;
  get(id: string): Promise<Asset | undefined>;
  byQr(code: string): Promise<Asset | undefined>;
  history(assetId: string): Promise<WorkOrder[]>;
  diagnosis(assetId: string, asOf?: ISODate): Promise<DiagnosisContext | undefined>;
}

export interface DlpSummary {
  recoveredYtdAed: number;
  pendingRecoveryAed: number;
  disputedAed: number;
  openDlpJobs: number;
  openDlpEstimateAed: number;
  bySubcontractor: Array<{ subcontractorId: string; jobs: number; recoveredAed: number; pendingAed: number }>;
  byMonth: Array<{ month: string; recoveredAed: number; dlpJobs: number; chargeableJobs: number }>;
}

export interface BatchAlert {
  batch: string;
  subcontractorId: string;
  siteId: string;
  rootCause: RootCause;
  count: number;
  windowDays: number;
  assetTags: string[];
  floors: [number, number];
}

export interface DlpService {
  backCharges(filter?: { subcontractorId?: string; status?: BackCharge["status"] }): Promise<BackCharge[]>;
  backCharge(id: string): Promise<BackCharge | undefined>;
  summary(): Promise<DlpSummary>;
  batchAlerts(): Promise<BatchAlert[]>;
  setBackChargeStatus(id: string, status: BackCharge["status"], actorId: string): Promise<BackCharge>;
}

export interface HandoverService {
  pack(siteId: string): Promise<HandoverPackItem[]>;
  snags(siteId: string): Promise<Snag[]>;
  moveSnag(id: string, status: SnagStatus): Promise<Snag>;
}

export interface ComplianceService {
  items(siteId?: string): Promise<ComplianceItem[]>;
  rag(item: ComplianceItem, now: number): Rag;
}

export interface PpmService {
  schedules(siteId?: string): Promise<PpmSchedule[]>;
}

export interface PermitService {
  list(siteId?: string): Promise<Permit[]>;
  setStatus(id: string, status: Permit["status"], actorId: string): Promise<Permit>;
}

export interface FleetService {
  equipment(): Promise<Equipment[]>;
  breakdowns(): Promise<Breakdown[]>;
}

export interface SlaSummary {
  met: number;
  total: number;
  pct: number;
  responseMetPct: number;
}

export interface CommandCentre {
  asOf: number;
  sla: SlaSummary;
  slaTrend: Array<{ month: string; pct: number }>;
  openByPriority: Record<Priority, number>;
  openTotal: number;
  atRisk: WorkOrder[];
  dlp: DlpSummary;
  complianceRag: Record<Rag, number>;
  fleetAvailabilityPct: number;
  fleetDown: number;
  acHeat: Array<{ floor: number; weeks: number[] }>;
  batchAlerts: BatchAlert[];
}

export interface MonthlyReport {
  siteId: string;
  month: string; // YYYY-MM
  totals: { raised: number; closed: number; slaPct: number; responsePct: number; dlpJobs: number; chargeableJobs: number; recoveredAed: number };
  byCategory: Array<{ category: Category; count: number }>;
  byChannel: Array<{ channel: Channel; count: number }>;
  ppm: { due: number; done: number; pct: number };
  compliance: ComplianceItem[];
  breaches: WorkOrder[];
  eventsLogged: number;
}

export interface ReportService {
  commandCentre(siteIds?: string[]): Promise<CommandCentre>;
  monthly(siteId: string, month: string): Promise<MonthlyReport>;
}

// ---- AI preview (mocked). Never presented as a shipped Kissflow capability. -------------------
export interface TriageSuggestion {
  category: Category;
  confidence: number;
  priority: Priority;
  summerUplift: boolean;
  assetId?: string;
  liability?: Liability;
  translation?: Bilingual;
  signals: string[];
  rationale: Bilingual;
}

export interface DiagnosisHypothesis {
  rootCause: RootCause;
  confidence: number;
  evidence: Bilingual;
}

export interface AskAnswer {
  answer: Bilingual;
  rows?: Array<{ label: string; value: string }>;
  link?: { to: string; label: Bilingual };
  sources: string[];
}

export interface ExtractedRequest {
  messageIds: string[];
  siteId: string;
  unitLabel?: string;
  category: Category;
  summary: Bilingual;
  firstContact: string;
}

export interface AiService {
  triage(text: string, lang: Lang, context: { siteId: string; unitId?: string; at: ISODate }): Promise<TriageSuggestion>;
  diagnose(workOrderId: string): Promise<DiagnosisHypothesis[]>;
  draftCloseout(workOrderId: string, rootCause: RootCause): Promise<Bilingual>;
  ask(question: string): Promise<AskAnswer>;
  suggestedQuestions(): Bilingual[];
  reportNarrative(report: MonthlyReport): Promise<Bilingual>;
  extractFromChat(messages: ChatMessage[]): Promise<ExtractedRequest[]>;
}

export interface DemoService {
  chat(): Promise<ChatMessage[]>;
  reset(): void;
  storyWorkOrderId(): string | undefined;
  /** Beat helpers for the guided demo (mock only; a Kissflow adapter would no-op). */
  runStoryStep(step: "raise" | "accept" | "resolve_dlp" | "resolve_chargeable" | "close"): Promise<string | undefined>;
}

/** One voice call with the AI agent (Kissflow: "AI Conversations", CAFM_AI_Conversation_A00). */
export interface AiConversation {
  id: string;
  sessionId: string;
  startedAt: ISODate;
  endedAt?: ISODate;
  durationSeconds?: number;
  lang: Lang;
  callerName?: string;
  callerRole?: string;
  voiceEngine: string;
  model?: string;
  workOrderRef?: string;
  workOrderId?: string;
  transcript: string;
  summary?: string;
  keyPoints?: string[];
  actionItems?: string[];
  openQuestions?: string[];
  sentiment?: string;
  intents?: string[];
  issuesRaised?: string[];
  suggestedFollowUps?: string[];
  insightsJson?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}
export interface ConversationService {
  list(): Promise<AiConversation[]>;
  save(c: Omit<AiConversation, "id">): Promise<AiConversation>;
  update(id: string, patch: Partial<Omit<AiConversation, "id">>): Promise<AiConversation>;
}

export interface Services {
  clock: ClockService;
  directory: DirectoryService;
  estate: EstateService;
  workOrders: WorkOrderService;
  assets: AssetService;
  dlp: DlpService;
  handover: HandoverService;
  compliance: ComplianceService;
  ppm: PpmService;
  permits: PermitService;
  fleet: FleetService;
  reports: ReportService;
  ai: AiService;
  conversations: ConversationService;
  /** AI settings rows in Kissflow (prompt, and for the POC the Gemini key). */
  aiSettings: import("./kissflow/aiSettings").AiSettingsService;
  demo: DemoService;
  /** Change notification so views refresh after writes (Kissflow adapter: refetch/poll). */
  subscribe(listener: () => void): () => void;
}
