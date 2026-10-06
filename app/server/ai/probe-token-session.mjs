// One-off probe: mint a token via the running dev server, connect as the browser would, check tool call + transcription + resumption.
// usage: node server/ai/probe-token-session.mjs   (needs npm run dev)
import { GoogleGenAI, Modality } from "@google/genai";
const r = await fetch("http://127.0.0.1:5188/api/live-token", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:5188" }, body: JSON.stringify({ userId: "probe", lang: "en" }) });
const t = await r.json(); if (!r.ok) { console.log("token failed", t); process.exit(1); }
const ai = new GoogleGenAI({ apiKey: t.token, httpOptions: { apiVersion: t.apiVersion } });
const seen = { audioBytes: 0, rate: "", outText: "", inText: "", tool: null, handle: false, usage: null, err: null };
await new Promise(async (resolve) => {
  const timer = setTimeout(resolve, 25000);
  const s = await ai.live.connect({ model: t.model, config: { responseModalities: [Modality.AUDIO] }, callbacks: {
    onmessage: (m) => {
      const sc = m.serverContent;
      if (sc?.modelTurn?.parts) for (const p of sc.modelTurn.parts) if (p.inlineData) { seen.audioBytes += Buffer.from(p.inlineData.data, "base64").length; seen.rate = p.inlineData.mimeType; }
      if (sc?.outputTranscription?.text) seen.outText += sc.outputTranscription.text;
      if (sc?.inputTranscription?.text) seen.inText += sc.inputTranscription.text;
      if (m.sessionResumptionUpdate?.newHandle) seen.handle = true;
      if (m.usageMetadata) seen.usage = m.usageMetadata.totalTokenCount;
      if (m.toolCall) { seen.tool = m.toolCall.functionCalls.map((f) => ({ name: f.name, args: f.args })); s.sendToolResponse({ functionResponses: m.toolCall.functionCalls.map((f) => ({ id: f.id, name: f.name, response: { ok: true } })) }); }
      if (sc?.turnComplete && seen.tool && seen.audioBytes > 0) { clearTimeout(timer); setTimeout(() => { s.close(); resolve(); }, 500); }
    },
    onerror: (e) => { seen.err = e.message ?? String(e); resolve(); }, onclose: (e) => { if (e.code !== 1000) seen.err = `closed ${e.code} ${e.reason}`; resolve(); } } });
  s.sendRealtimeInput({ text: "Hi, the AC in my living room has been blowing warm air since last night. Nobody vulnerable at home." });
});
console.log(JSON.stringify({ ...seen, outText: seen.outText.slice(0, 160) }, null, 1));
