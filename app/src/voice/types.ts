// Voice agent contract. The "brain" decides what to say and what it has learned; the speech layer
// (browser Web Speech today, Google Cloud in Phase 7) only moves audio <-> text. Both are swappable.
import type { Category, Lang } from "@/domain/types";

export type VoiceStage = "gathering" | "confirming" | "submit" | "handoff";

/** What the agent has captured so far — becomes the work order. */
export interface VoiceSlots {
  category?: Category;
  symptom?: string;
  room?: string;
  since?: string;
  vulnerableOccupant?: boolean;
  safetyHazard?: boolean;
  access?: string;
  summary?: string;
  /** Demo brain bookkeeping: which question is waiting for an answer. */
  asked?: "category" | "symptom" | "room" | "since" | "vulnerable" | "access" | "confirm";
}

export interface VoiceContext {
  residentName: string;
  unitLabel: string; // "Apt 1402"
  siteName: string; // "Qamar Residences"
  /** Liability preview for the resident's AC unit, so the agent can say "no cost to you". */
  inDlp: boolean;
  lang: Lang;
}

export interface VoiceLine {
  role: "caller" | "agent";
  text: string;
  interrupted?: boolean;
}

export interface VoiceTurnInput {
  history: VoiceLine[];
  slots: VoiceSlots;
  context: VoiceContext;
  /** Language the caller just spoke in (the agent answers in the same language). */
  lang: Lang;
}

export interface VoiceTurnResult {
  say: string;
  slots: VoiceSlots;
  stage: VoiceStage;
  lang: Lang;
}

export interface VoiceBrain {
  readonly id: "demo" | "claude";
  greet(context: VoiceContext): string;
  /** Streams the reply: `onText` receives text as it is generated (so speech can start early). */
  respond(input: VoiceTurnInput, onText: (delta: string) => void, signal: AbortSignal): Promise<VoiceTurnResult>;
}
