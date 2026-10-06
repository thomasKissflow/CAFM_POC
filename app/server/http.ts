// The AI backend as one request handler (node:http compatible): mounted by the Vite dev server now and by
// server/index.ts as a standalone service (Cloud Run) later.
//   GET  /api/ai/health
//   POST /api/live-token          { userId, userName?, role?, lang }  → LiveTokenResponse
//   POST /api/summarize           { text, lang?, context?, userId? } → AiResponse<SummaryResult>
//   POST /api/insights            { text, lang?, context?, userId? } → AiResponse<InsightsResult>
//   GET  /api/ai/settings         → AiSettings                        (Admin UI)
//   PUT  /api/ai/settings         { voiceSystemPrompt, by }            (Admin UI)
//   POST /api/kf                  { method, path, body }               (DEV ONLY: local Kissflow proxy)
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiError, LiveTokenRequest } from "../shared/ai-types";
import { AI } from "./ai/config";
import { MisconfiguredError } from "./ai/gemini";
import { getSettings, saveVoicePrompt } from "./ai/settings";
import { mintLiveToken } from "./ai/voice";
import { callInsights, summarizeCall } from "./ai/text";
import { kfConfigured, kfRest } from "./kf/rest";

export interface ApiOptions { devKfProxy: boolean }

const hits = new Map<string, number[]>();
function limited(key: string, perHour: number): boolean {
  const now = Date.now(), recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= perHour) { hits.set(key, recent); return true; }
  recent.push(now); hits.set(key, recent); return false;
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 2_000_000) reject(new Error("body too large")); });
    req.on("end", () => { try { resolve(data === "" ? {} : JSON.parse(data)); } catch { reject(new Error("invalid JSON")); } });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
const fail = (res: ServerResponse, status: number, code: ApiError["code"], error: string) => send(res, status, { error, code } satisfies ApiError);

/** Answer 2 (Thomas): only our own pages may call the API. Same-origin dev requests may omit Origin. */
function originOk(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  if (!AI.allowedOrigins.includes(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  return true;
}

export function createApiHandler(opts: ApiOptions) {
  return async function handle(req: IncomingMessage, res: ServerResponse, next?: () => void) {
    const url = new URL(req.url ?? "/", "http://local");
    const mine = url.pathname.startsWith("/api/ai") || ["/api/live-token", "/api/summarize", "/api/insights", "/api/kf"].includes(url.pathname);
    if (!mine) { if (next !== undefined) next(); else fail(res, 404, "not_found", "not found"); return; }
    if (!originOk(req, res)) { fail(res, 403, "unauthorized", "origin not allowed"); return; }
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.statusCode = 204; res.end(); return;
    }
    try {
      if (url.pathname === "/api/ai/health" && req.method === "GET") {
        send(res, 200, { gemini: process.env.GEMINI_API_KEY !== undefined && process.env.GEMINI_API_KEY !== "", kissflow: kfConfigured(), liveModel: AI.liveModel, textModel: AI.textModel, devKfProxy: opts.devKfProxy });
        return;
      }
      if (url.pathname === "/api/live-token" && req.method === "POST") {
        const body = (await readJson(req)) as Partial<LiveTokenRequest>;
        if (typeof body.userId !== "string" || body.userId === "") { fail(res, 401, "unauthorized", "a signed-in user is required"); return; }
        if (limited(`tok:${body.userId}`, AI.rateLimit.tokensPerUserPerHour)) { fail(res, 429, "rate_limited", "voice session limit reached for this hour"); return; }
        send(res, 200, await mintLiveToken({ userId: body.userId, userName: body.userName, role: body.role, lang: body.lang === "ar" ? "ar" : "en", caller: typeof body.caller === "object" && body.caller !== null ? body.caller : undefined }));
        return;
      }
      if ((url.pathname === "/api/summarize" || url.pathname === "/api/insights") && req.method === "POST") {
        const body = (await readJson(req)) as { text?: unknown; lang?: unknown; context?: unknown; userId?: unknown };
        if (typeof body.text !== "string" || body.text.trim().length < 20) { fail(res, 400, "bad_request", "a transcript is required"); return; }
        const user = typeof body.userId === "string" && body.userId !== "" ? body.userId : "anonymous";
        if (limited(`ai:${user}`, AI.rateLimit.aiCallsPerUserPerHour)) { fail(res, 429, "rate_limited", "AI request limit reached for this hour"); return; }
        const r = { text: body.text, lang: body.lang === "ar" ? ("ar" as const) : ("en" as const), context: typeof body.context === "string" ? body.context : undefined };
        send(res, 200, url.pathname === "/api/summarize" ? await summarizeCall(r, user) : await callInsights(r, user));
        return;
      }
      if (url.pathname === "/api/ai/settings" && req.method === "GET") { send(res, 200, await getSettings()); return; }
      if (url.pathname === "/api/ai/settings" && req.method === "PUT") {
        const body = (await readJson(req)) as { voiceSystemPrompt?: unknown; by?: unknown; role?: unknown };
        if (body.role !== "admin") { fail(res, 403, "unauthorized", "only Admin can change AI settings"); return; }
        if (typeof body.voiceSystemPrompt !== "string" || body.voiceSystemPrompt.trim().length < 20) { fail(res, 400, "bad_request", "prompt is too short"); return; }
        send(res, 200, await saveVoicePrompt(body.voiceSystemPrompt, typeof body.by === "string" ? body.by : "Admin"));
        return;
      }
      if (url.pathname === "/api/kf" && req.method === "POST") {
        if (!opts.devKfProxy) { fail(res, 404, "not_found", "not found"); return; }
        const body = (await readJson(req)) as { method?: unknown; path?: unknown; body?: unknown };
        const path = typeof body.path === "string" ? body.path : "";
        // dev proxy is scoped to this app's flows only
        if (!/^\/(form|process|case|flow)\/2\/\{acc\}\//.test(path) || !path.includes("CAFM_")) { fail(res, 400, "bad_request", "path not allowed"); return; }
        const r = await kfRest(typeof body.method === "string" ? body.method : "GET", path, body.body);
        send(res, r.status, r.json);
        return;
      }
      fail(res, 404, "not_found", "not found");
    } catch (e) {
      if (e instanceof MisconfiguredError) { fail(res, 500, "misconfigured", e.message); return; }
      console.error("[ai] error", e instanceof Error ? e.message : "unknown");
      fail(res, 502, "upstream", e instanceof Error ? e.message.slice(0, 200) : "upstream error");
    }
  };
}
