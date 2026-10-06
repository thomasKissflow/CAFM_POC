// Generates the voice-over: one WAV per beat, via Gemini TTS, plus a manifest of durations.
// The recorder reads the manifest so every beat is held for exactly as long as its narration.
// usage: node scripts/video/narrate.mjs [--force]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { BEATS } from "./storyboard.mjs";

const OUT = new URL("./build/audio/", import.meta.url);
const RATE = 24000; // Gemini TTS returns 16-bit mono PCM at 24 kHz
const VOICE = process.env.NARRATOR_VOICE ?? "Charon"; // calm, low; other options: Kore, Puck, Aoede
const STYLE = "Read as a confident product narrator for a business audience: calm, clear, unhurried, warm but not salesy. Short pauses at full stops.";

for (const line of readFileSync(new URL("../../../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m !== null && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
if ((process.env.GEMINI_API_KEY ?? "") === "") { console.error("GEMINI_API_KEY missing"); process.exit(1); }

mkdirSync(OUT, { recursive: true });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const force = process.argv.includes("--force");

/** PCM → WAV, so ffmpeg (and any player) can read the clip directly. */
function wav(pcm) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);            // PCM
  header.writeUInt16LE(1, 22);            // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);     // byte rate
  header.writeUInt16LE(2, 32);            // block align
  header.writeUInt16LE(16, 34);           // bits
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const manifest = [];
for (const beat of BEATS) {
  const file = new URL(`./${beat.id}.wav`, OUT);
  if (!force && existsSync(file)) {
    const ms = Math.round(((readFileSync(file).length - 44) / (RATE * 2)) * 1000);
    manifest.push({ id: beat.id, ms });
    console.log(`· ${beat.id.padEnd(14)} kept      ${(ms / 1000).toFixed(1)}s`);
    continue;
  }
  const r = await ai.models.generateContent({
    model: process.env.TTS_MODEL ?? "gemini-3.1-flash-tts-preview",
    contents: `${STYLE}\n\n${beat.say}`,
    config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } }
  });
  const part = (r.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData !== undefined);
  if (part === undefined) { console.error(`✗ ${beat.id}: no audio returned`); process.exit(1); }
  const pcm = Buffer.from(part.inlineData.data, "base64");
  writeFileSync(file, wav(pcm));
  const ms = Math.round((pcm.length / (RATE * 2)) * 1000);
  manifest.push({ id: beat.id, ms });
  console.log(`✓ ${beat.id.padEnd(14)} narrated  ${(ms / 1000).toFixed(1)}s`);
}

writeFileSync(new URL("./manifest.json", OUT), JSON.stringify(manifest, null, 1));
const total = manifest.reduce((s, m) => s + m.ms, 0);
console.log(`\nvoice-over: ${manifest.length} beats · ${(total / 1000 / 60).toFixed(1)} min of speech`);
