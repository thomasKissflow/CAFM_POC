// Calls to the CAFM AI backend (server/http.ts). No secrets here: the backend holds the Gemini and Kissflow keys.
// Local dev: same origin (the Vite dev server). Inside Kissflow: VITE_AI_API_BASE = the Cloud Run URL (a URL, not a secret).
import type { AiResponse, AiSettings, ApiError, InsightsRequest, InsightsResult, LiveTokenRequest, LiveTokenResponse, SummarizeRequest, SummaryResult } from "../../../shared/ai-types";

export const AI_BASE: string = (import.meta.env.VITE_AI_API_BASE as string | undefined) ?? "";

export interface AiHealth { gemini: boolean; kissflow: boolean; liveModel: string; textModel: string; devKfProxy: boolean }

export class AiApiError extends Error {
  constructor(message: string, readonly code: ApiError["code"] | "network", readonly status: number) { super(message); }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${AI_BASE}${path}`, { method, headers: body !== undefined ? { "Content-Type": "application/json" } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new AiApiError("The AI backend can't be reached", "network", 0);
  }
  let j: unknown; try { j = await r.json(); } catch { j = null; }
  if (!r.ok) {
    const e = (j !== null && typeof j === "object" ? j : {}) as Partial<ApiError>;
    throw new AiApiError(typeof e.error === "string" ? e.error : `AI backend error ${r.status}`, e.code ?? "upstream", r.status);
  }
  return j as T;
}

/** Undefined when there is no AI backend (e.g. the Kissflow build without VITE_AI_API_BASE). */
export async function aiHealth(timeoutMs = 2500): Promise<AiHealth | undefined> {
  if (inKissflowWithoutBackend()) return undefined;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(`${AI_BASE}/api/ai/health`, { signal: ctl.signal }); clearTimeout(t);
    return r.ok ? ((await r.json()) as AiHealth) : undefined;
  } catch { return undefined; }
}
function inKissflowWithoutBackend() { return AI_BASE === "" && typeof window !== "undefined" && window.self !== window.top; }

export const fetchLiveToken = (req: LiveTokenRequest) => call<LiveTokenResponse>("POST", "/api/live-token", req);
export const postSummarize = (req: SummarizeRequest) => call<AiResponse<SummaryResult>>("POST", "/api/summarize", req);
export const postInsights = (req: InsightsRequest) => call<AiResponse<InsightsResult>>("POST", "/api/insights", req);
export const getAiSettings = () => call<AiSettings>("GET", "/api/ai/settings");
export const saveAiSettings = (voiceSystemPrompt: string, by: string) => call<AiSettings>("PUT", "/api/ai/settings", { voiceSystemPrompt, by, role: "admin" });

// ---- voice engine choice (per browser; data always comes from Kissflow) -----------------------------
export type VoiceEngine = "demo" | "live";
const KEY = "cafm.voiceEngine";
export function getVoiceEngine(): VoiceEngine {
  try { return localStorage.getItem(KEY) === "live" ? "live" : "demo"; } catch { return "demo"; }
}
export function setVoiceEngine(e: VoiceEngine) {
  try { localStorage.setItem(KEY, e); } catch { /* storage blocked: stays on the default */ }
  window.dispatchEvent(new Event("cafm-voice-engine"));
}
