// Gemini client factory, retry with backoff on rate limits, and usage logging (counts only: no content, no keys).
import { GoogleGenAI } from "@google/genai";
import type { UsageNote } from "../../shared/ai-types";
import { AI } from "./config";

export class MisconfiguredError extends Error {}

/** The server-side client. The key is read from process.env only; it is never logged or returned. */
export function geminiClient(apiVersion?: string): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (key === undefined || key === "") throw new MisconfiguredError("GEMINI_API_KEY is not set on the server");
  return new GoogleGenAI({ apiKey: key, ...(apiVersion !== undefined ? { httpOptions: { apiVersion } } : {}) });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const statusOf = (e: unknown): number | undefined => {
  if (e === null || typeof e !== "object") return undefined;
  const s = (e as { status?: unknown; code?: unknown }).status ?? (e as { code?: unknown }).code;
  return typeof s === "number" ? s : undefined;
};

/** Retries 429 (rate limit) and 5xx with exponential backoff + jitter. Other errors fail fast. */
export async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < AI.retry.attempts; attempt++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      const st = statusOf(e);
      const retryable = st === 429 || (st !== undefined && st >= 500) || /429|RESOURCE_EXHAUSTED|UNAVAILABLE/.test(String((e as Error).message ?? ""));
      if (!retryable || attempt === AI.retry.attempts - 1) break;
      const wait = AI.retry.baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 250);
      console.warn(`[ai] ${label}: ${st ?? "error"} → retry ${attempt + 1} in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw last;
}

/** One line per Gemini request: endpoint, model, token counts. Never content, never keys. */
export function logUsage(endpoint: string, u: UsageNote, extra: Record<string, string | number | undefined> = {}) {
  const parts = Object.entries({ endpoint, model: u.model, in: u.inputTokens, out: u.outputTokens, total: u.totalTokens, ...extra })
    .filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`);
  console.info(`[ai-usage] ${new Date().toISOString()} ${parts.join(" ")}`);
}
