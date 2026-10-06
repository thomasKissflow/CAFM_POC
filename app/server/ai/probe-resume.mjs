// One-off probe: can a second single-use token resume the first session by handle (with every setup field locked)?
import { GoogleGenAI, Modality } from "@google/genai";
const { RECORD_REQUEST } = await import("../../shared/voice-tool.ts");
const token = async () => { const r = await fetch("http://127.0.0.1:5188/api/live-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: "probe-resume", lang: "en" }) }); return r.json(); };
async function run(handle, text) {
  const t = await token();
  const ai = new GoogleGenAI({ apiKey: t.token, httpOptions: { apiVersion: t.apiVersion } });
  const out = { handle: undefined, text: "", err: undefined, tool: undefined };
  await new Promise(async (resolve) => {
    const timer = setTimeout(resolve, 25000);
    const s = await ai.live.connect({ model: t.model, config: { responseModalities: [Modality.AUDIO], tools: [{ functionDeclarations: [RECORD_REQUEST] }], sessionResumption: handle ? { handle } : {}, ...(handle ? { sessionResumption: { handle } } : {}) }, callbacks: {
      onmessage: (m) => {
        if (m.sessionResumptionUpdate?.resumable && m.sessionResumptionUpdate.newHandle) out.handle = m.sessionResumptionUpdate.newHandle;
        if (m.serverContent?.outputTranscription?.text) out.text += m.serverContent.outputTranscription.text;
        if (m.toolCall) { out.tool = m.toolCall.functionCalls[0].args; s.sendToolResponse({ functionResponses: m.toolCall.functionCalls.map((f) => ({ id: f.id, name: f.name, response: { ok: true } })) }); }
        if (m.serverContent?.turnComplete && out.text) { clearTimeout(timer); setTimeout(() => { s.close(); resolve(); }, 1500); }
      },
      onerror: (e) => { out.err = e.message; resolve(); }, onclose: (e) => { if (e.code !== 1000) out.err = `closed ${e.code} ${e.reason}`; resolve(); } } });
    s.sendRealtimeInput({ text });
  });
  return out;
}
const a = await run(undefined, "Hi, water is dripping from the ceiling in my master bedroom since this morning.");
console.log("1st:", { gotHandle: !!a.handle, text: a.text.slice(0, 120), err: a.err });
const b = await run(a.handle, "Sorry, the line dropped. Which room did I say the problem was in?");
console.log("2nd (resumed):", { text: b.text.slice(0, 160), err: b.err, tool: b.tool });
