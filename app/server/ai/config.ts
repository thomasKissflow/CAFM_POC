// ALL Gemini configuration lives here: model IDs, voice, prompts, token lifetimes, limits.
// Model IDs verified against https://ai.google.dev/gemini-api/docs/models (22 Sep 2026).
// Override any of them with env vars (server-side only; never VITE_-prefixed).
import { DEFAULT_VOICE_PROMPT } from "./prompts";

const env = (k: string, d: string) => (process.env[k] !== undefined && process.env[k] !== "" ? (process.env[k] as string) : d);

export const AI = {
  /** Live voice model. Switch to "gemini-3.8-live-extended-thinking" for harder reasoning (needs thinkingConfig + non-blocking tools). */
  liveModel: env("GEMINI_LIVE_MODEL", "gemini-3.8-live"),
  /** Text model for summaries and insights (latest stable Flash). */
  textModel: env("GEMINI_TEXT_MODEL", "gemini-3.8-flash"),
  /** Reserved for later cross-conversation search (not used yet). */
  embeddingModel: env("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001"),
  /** Prebuilt voice for the Live API. */
  voiceName: env("GEMINI_VOICE", "Kore"),
  /** Ephemeral tokens: the SDK supports them on v1alpha (probe on 22 Sep: v1alpha works; the SDK warns against v1beta). */
  liveApiVersion: "v1alpha",
  /** Token lifetime: the session must START within newSessionSeconds; messages stop after expireMinutes. */
  token: { uses: 1, newSessionSeconds: 60, expireMinutes: 30 },
  /** Per-user rate limit for tokens (Thomas, answer 2). */
  rateLimit: { tokensPerUserPerHour: Number(env("AI_TOKENS_PER_HOUR", "10")), aiCallsPerUserPerHour: Number(env("AI_CALLS_PER_HOUR", "60")) },
  /** Only these page origins may call the API (localhost for dev, the Kissflow app for production). */
  allowedOrigins: env("AI_ALLOWED_ORIGINS", "http://localhost:5188,http://127.0.0.1:5188,https://resource.as.kissflow.store,https://development-r1100.kissflow.com").split(",").map((s) => s.trim()),
  /** Default system prompt; the live one is edited by Admin and stored in Kissflow (AI Settings: voice_system_prompt). */
  defaultVoicePrompt: DEFAULT_VOICE_PROMPT,
  /** Retry policy for 429 / 503 from Gemini. */
  retry: { attempts: 4, baseDelayMs: 800 }
} as const;
