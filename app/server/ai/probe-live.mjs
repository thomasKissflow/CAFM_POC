// One-off probe: which apiVersion mints ephemeral tokens, and does a token-authenticated Live session work?
// Reads GEMINI_API_KEY from ../.env into process.env; never prints it.
import { readFileSync } from "node:fs";
import { GoogleGenAI, Modality } from "@google/genai";
for (const l of readFileSync(new URL("../../../.env", import.meta.url), "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
if (!process.env.GEMINI_API_KEY) { console.log("GEMINI_API_KEY missing"); process.exit(1); }
const MODEL = "gemini-3.8-live";
for (const apiVersion of ["v1alpha", "v1beta"]) {
  const server = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion } });
  let token;
  try {
    token = await server.authTokens.create({ config: { uses: 1, expireTime: new Date(Date.now() + 10 * 60e3).toISOString(), newSessionExpireTime: new Date(Date.now() + 60e3).toISOString(),
      liveConnectConstraints: { model: MODEL, config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, outputAudioTranscription: {}, systemInstruction: "You are a brief maintenance helpdesk assistant." } } } });
    console.log(`${apiVersion}: token minted (${String(token.name).slice(0, 12)}…)`);
  } catch (e) { console.log(`${apiVersion}: token failed — ${String(e.message).slice(0, 200)}`); continue; }
  const client = new GoogleGenAI({ apiKey: token.name, httpOptions: { apiVersion } });
  const got = { audioBytes: 0, out: "", turnComplete: false, usage: null, err: null };
  await new Promise(async (resolve) => {
    const timer = setTimeout(resolve, 20000);
    try {
      const session = await client.live.connect({ model: MODEL, config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, outputAudioTranscription: {} },
        callbacks: {
          onmessage: (m) => {
            for (const p of m.serverContent?.modelTurn?.parts ?? []) if (p.inlineData?.data) got.audioBytes += Buffer.from(p.inlineData.data, "base64").length, got.mime = p.inlineData.mimeType;
            if (m.serverContent?.outputTranscription?.text) got.out += m.serverContent.outputTranscription.text;
            if (m.usageMetadata) got.usage = m.usageMetadata.totalTokenCount;
            if (m.serverContent?.turnComplete) { got.turnComplete = true; clearTimeout(timer); resolve(); }
          },
          onerror: (e) => { got.err = e.message ?? String(e); }, onclose: (e) => { if (!got.turnComplete) got.err = got.err ?? `closed ${e.code} ${e.reason}`; clearTimeout(timer); resolve(); }
        } });
      session.sendRealtimeInput({ text: "My AC is not cooling. Reply in one short sentence." });
      setTimeout(() => session.close(), 19000);
    } catch (e) { got.err = String(e.message ?? e); resolve(); }
  });
  console.log(`${apiVersion}: live session → audio ${got.audioBytes} bytes (${got.mime}), transcript "${got.out.trim().slice(0, 120)}", turnComplete ${got.turnComplete}, totalTokens ${got.usage}${got.err ? ", error " + got.err : ""}`);
}
