// One way in to the AI features, whichever way the app is running:
//   "backend" — our server holds the Gemini key (local dev now, Cloud Run in production). Preferred.
//   "browser" — POC only: no server of ours is reachable (the app runs inside Kissflow), so the key is read from
//               the Kissflow "AI Settings" row and Gemini is called straight from this page. See PRODUCTION_TODO.md.
//   "off"     — no backend and no stored key: the app uses the demo voice and skips summaries.
import type { GoogleGenAI } from "@google/genai";
import type { AiConversation, Services } from "@/services/types";
import type { AiResponse, InsightsRequest, InsightsResult, LiveTokenRequest, LiveTokenResponse, SummarizeRequest, SummaryResult } from "../../shared/ai-types";
import { AI_DEFAULTS, insights as coreInsights, mintToken, summarize as coreSummarize } from "../../shared/ai-core";
import { DEFAULT_VOICE_PROMPT } from "../../shared/voice-prompt";
import { aiHealth, AiApiError, fetchLiveToken, getAiSettings, postInsights, postSummarize, saveAiSettings, type AiHealth } from "@/voice/live/aiApi";
import { KEY_GEMINI, KEY_PROMPT } from "@/services/kissflow/aiSettings";

export type AiMode = "backend" | "browser" | "off";

export interface AiProvider {
  mode: AiMode;
  liveModel: string;
  textModel: string;
  /** Why the live voice isn't available, when it isn't. */
  reason?: string;
  liveToken(req: LiveTokenRequest): Promise<LiveTokenResponse>;
  summarize(req: SummarizeRequest): Promise<AiResponse<SummaryResult>>;
  insights(req: InsightsRequest): Promise<AiResponse<InsightsResult>>;
  prompt(): Promise<{ voiceSystemPrompt: string; updatedBy?: string; updatedAt?: string }>;
  savePrompt(prompt: string, by: string): Promise<void>;
  /** POC only, browser mode: store (or replace) the Gemini key in Kissflow. The value is never logged. */
  saveKey?(key: string, by: string): Promise<void>;
  /** True when a key is stored in Kissflow (the value itself is never handed out). */
  hasStoredKey?: boolean;
}

let cached: { at: number; provider: AiProvider } | undefined;
const FRESH_MS = 30_000;

async function browserClient(key: string): Promise<GoogleGenAI> {
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: AI_DEFAULTS.liveApiVersion } });
}

function backendProvider(health: AiHealth): AiProvider {
  return {
    mode: "backend", liveModel: health.liveModel, textModel: health.textModel,
    liveToken: (req) => fetchLiveToken(req),
    summarize: (req) => postSummarize(req),
    insights: (req) => postInsights(req),
    async prompt() { const s = await getAiSettings(); return { voiceSystemPrompt: s.voiceSystemPrompt, updatedBy: s.updatedBy, updatedAt: s.updatedAt }; },
    async savePrompt(p, by) { await saveAiSettings(p, by); }
  };
}

/** POC: the key lives in Kissflow and is used from this page. It is read per call and never kept in module state. */
function browserProvider(services: Services, hasKey: boolean): AiProvider {
  const key = async () => {
    const s = await services.aiSettings.read();
    if (s.geminiKey === undefined || s.geminiKey.trim() === "") throw new AiApiError("No Gemini key is stored in Kissflow (Admin → AI settings)", "misconfigured", 0);
    return s.geminiKey.trim();
  };
  const promptOf = async () => {
    const s = await services.aiSettings.read();
    return { voiceSystemPrompt: s.voiceSystemPrompt !== undefined && s.voiceSystemPrompt.trim() !== "" ? s.voiceSystemPrompt : DEFAULT_VOICE_PROMPT, updatedBy: s.updatedBy, updatedAt: s.updatedAt };
  };
  return {
    mode: "browser", liveModel: AI_DEFAULTS.liveModel, textModel: AI_DEFAULTS.textModel, hasStoredKey: hasKey,
    async liveToken(req) {
      const [k, p] = await Promise.all([key(), promptOf()]);
      const ai = await browserClient(k);
      const t = await mintToken(ai, { model: AI_DEFAULTS.liveModel, prompt: p.voiceSystemPrompt, lang: req.lang, caller: req.caller, voiceName: AI_DEFAULTS.voiceName });
      return { token: t.token, model: AI_DEFAULTS.liveModel, apiVersion: AI_DEFAULTS.liveApiVersion, expiresAt: t.expiresAt, newSessionBy: t.newSessionBy, voiceName: AI_DEFAULTS.voiceName };
    },
    async summarize(req) { return coreSummarize(await browserClient(await key()), AI_DEFAULTS.textModel, req); },
    async insights(req) { return coreInsights(await browserClient(await key()), AI_DEFAULTS.textModel, req); },
    prompt: promptOf,
    async savePrompt(p, by) { await services.aiSettings.write(KEY_PROMPT, p, by); },
    async saveKey(k, by) { await services.aiSettings.write(KEY_GEMINI, k.trim(), by); }
  };
}

function offProvider(reason: string): AiProvider {
  const no = () => Promise.reject(new AiApiError(reason, "misconfigured", 0));
  return {
    mode: "off", liveModel: AI_DEFAULTS.liveModel, textModel: AI_DEFAULTS.textModel, reason,
    liveToken: no, summarize: no, insights: no,
    async prompt() { return { voiceSystemPrompt: DEFAULT_VOICE_PROMPT }; },
    savePrompt: () => Promise.reject(new AiApiError(reason, "misconfigured", 0))
  };
}

/** ?ai=browser / ?ai=backend forces a mode (for testing the in-Kissflow path from a laptop). */
function forced(): AiMode | undefined {
  if (typeof window === "undefined") return undefined;
  const v = new URLSearchParams(window.location.search).get("ai");
  return v === "browser" || v === "backend" ? v : undefined;
}

/** Picks the mode once per half-minute: our backend first, then the key stored in Kissflow, else off. */
export async function getAiProvider(services: Services, force = false): Promise<AiProvider> {
  if (!force && cached !== undefined && Date.now() - cached.at < FRESH_MS) return cached.provider;
  let provider: AiProvider;
  const health = forced() === "browser" ? undefined : await aiHealth();
  if (health !== undefined && health.gemini) provider = backendProvider(health);
  else {
    let stored: string | undefined;
    try { stored = (await services.aiSettings.read()).geminiKey; } catch { stored = undefined; }
    provider = stored !== undefined && stored.trim() !== ""
      ? browserProvider(services, true)
      : offProvider(health !== undefined && !health.gemini
        ? "The AI backend has no Gemini key."
        : "No AI backend is reachable and no Gemini key is stored in Kissflow (Admin → AI settings).");
  }
  cached = { at: Date.now(), provider };
  return provider;
}

/** Called after settings change so the next call re-checks. */
export const forgetAiProvider = () => { cached = undefined; };

/** Summary + insights for one saved call, stored back on the conversation row. Best effort: failures are logged. */
export async function enrichConversation(provider: AiProvider, services: Services, c: AiConversation): Promise<void> {
  if (provider.mode === "off" || c.transcript.trim().length < 40) return;
  const context = `Language: ${c.lang === "ar" ? "Arabic" : "English"}.${c.workOrderRef !== undefined ? ` Work order ${c.workOrderRef}.` : ""}`;
  const [s, i] = await Promise.all([
    provider.summarize({ text: c.transcript, lang: c.lang, context }),
    provider.insights({ text: c.transcript, lang: c.lang, context })
  ]);
  const tokens = (s.usage.totalTokens ?? 0) + (i.usage.totalTokens ?? 0);
  await services.conversations.update(c.id, {
    summary: s.result.summary, keyPoints: s.result.keyPoints, actionItems: s.result.actionItems, openQuestions: s.result.openQuestions,
    sentiment: `${i.result.sentiment}${i.result.sentimentReason !== "" ? ` — ${i.result.sentimentReason}` : ""}`,
    intents: [...i.result.intents, ...i.result.topics],
    issuesRaised: i.result.issuesRaised.map((x) => `${x.severity.toUpperCase()}: ${x.issue}`),
    suggestedFollowUps: i.result.suggestedFollowUps,
    insightsJson: JSON.stringify(i.result),
    totalTokens: (c.totalTokens ?? 0) + tokens
  });
}
