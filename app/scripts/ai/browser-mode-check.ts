// Proves the "inside Kissflow" path without a browser: the key is read from the Kissflow AI Settings row (never
// printed), a single-use token is minted with it, a live session answers and calls record_request, and the
// summary/insights come back. Same calls the Custom UI makes when no backend of ours is reachable.
// usage: npx vite-node --root . scripts/ai/browser-mode-check.mjs      (writes nothing to Kissflow)
import { GoogleGenAI, Modality } from "@google/genai";
// @ts-expect-error plain ESM helper
import { kf } from "../../../data-model/kf-call.mjs";
import { RECORD_REQUEST } from "../../shared/voice-tool";
import { AI_DEFAULTS, liveSessionConfig, summarize, insights } from "../../shared/ai-core";

const Q = "?_application_id=CAFM_POC_A00";
let fails = 0;
const check = (name: string, ok: boolean, info = "") => { console.log(`${ok ? "✓" : "✗"} ${name}${info !== "" ? ` (${info})` : ""}`); if (!ok) fails++; };

// 1. settings from Kissflow, as the app reads them
const rows = (await kf("POST", `/form/2/{acc}/CAFM_AI_Setting_A00/allitems/list${Q}&page_size=100&page_number=1`, {})).json.Data ?? [];
const row = (k: string) => rows.find((r: any) => r.Setting_Key === k);
const key = String(row("gemini_api_key")?.Setting_Value ?? "");
const prompt = String(row("voice_system_prompt")?.Setting_Value ?? "");
check("Gemini key stored in Kissflow", key.length > 20, `${key.length} characters, ends …${key.slice(-4)}`);
check("Voice prompt stored in Kissflow", prompt.length > 200, `${prompt.length} characters`);
if (key.length < 20) process.exit(1);

// 2. token minted in the page, with the same lock the server uses
const ai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: AI_DEFAULTS.liveApiVersion } });
const caller = { residentName: "Layla Al Suwaidi", unitLabel: "Apt 1402", siteName: "Qamar Residences", inDlp: true };
let token: any;
try {
  token = await ai.authTokens.create({ config: { uses: 1, expireTime: new Date(Date.now() + 10 * 60e3).toISOString(), newSessionExpireTime: new Date(Date.now() + 60e3).toISOString(),
    liveConnectConstraints: { model: AI_DEFAULTS.liveModel, config: liveSessionConfig(prompt, "en", caller) }, lockAdditionalFields: [] } });
  check("Single-use voice token", typeof token.name === "string");
} catch (e: any) { check("Single-use voice token", false, String(e.message).slice(0, 120)); process.exit(1); }

// 3. a live session, as the browser runs it
const live = new GoogleGenAI({ apiKey: token.name, httpOptions: { apiVersion: AI_DEFAULTS.liveApiVersion } });
const seen = { audio: 0, said: "", tool: null as any, err: null as string | null };
await new Promise<void>(async (resolve) => {
  const timer = setTimeout(resolve, 25000);
  const s = await live.live.connect({
    model: AI_DEFAULTS.liveModel,
    config: { responseModalities: [Modality.AUDIO], tools: [{ functionDeclarations: [RECORD_REQUEST] }], sessionResumption: {} },
    callbacks: {
      onmessage: (m: any) => {
        if (m.toolCall) { seen.tool = m.toolCall.functionCalls[0].args; s.sendToolResponse({ functionResponses: m.toolCall.functionCalls.map((f: any) => ({ id: f.id, name: f.name, response: { ok: true } })) }); }
        const sc = m.serverContent;
        if (!sc) return;
        if (sc.outputTranscription?.text) seen.said += sc.outputTranscription.text;
        for (const p of sc.modelTurn?.parts ?? []) if (p.inlineData?.data) seen.audio += Buffer.from(p.inlineData.data, "base64").length;
        if (sc.turnComplete && seen.audio > 0 && seen.tool) { clearTimeout(timer); s.close(); resolve(); }
      },
      onerror: (e: any) => { seen.err = e.message; resolve(); },
      onclose: (e: any) => { if (e.code !== 1000 && seen.audio === 0) seen.err = `closed ${e.code}`; resolve(); }
    }
  });
  s.sendRealtimeInput({ text: "Hello, the AC in my living room is blowing warm air since last night and my baby is at home." });
});
check("Live session speaks", seen.err === null && seen.audio > 0, seen.err ?? `${Math.round(seen.audio / 1024)} kB audio · "${seen.said.slice(0, 50)}"`);
check("Job card filled by the agent", seen.tool !== null, seen.tool !== null ? Object.keys(seen.tool).join(", ") : "no record_request call");

// 4. summary + insights with the same key
const SAMPLE = "[10:00] CAFM: Hello, how can I help?\n[10:00] Caller: The AC in the living room is blowing warm air since last night and my baby is at home.\n[10:01] Caller: Any time today is fine, I'm home. This is the second time this month.";
const s = await summarize(ai, AI_DEFAULTS.textModel, { text: SAMPLE, lang: "en" });
check("Summary", s.result.summary.length > 20 && s.result.keyPoints.length > 0, `${s.result.keyPoints.length} key points · ${s.usage.totalTokens} tokens`);
const i = await insights(ai, AI_DEFAULTS.textModel, { text: SAMPLE, lang: "en" });
check("Insights", i.result.intents.length > 0, `${i.result.sentiment} · ${i.result.issuesRaised.length} issues`);

console.log(fails === 0 ? "\nall passed" : `\n${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
