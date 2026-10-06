// Saves, updates and reads back one [TEST] AI Conversation row in Kissflow through the real adapter code.
// usage: npx vite-node --root . scripts/kf/ai-conversation-check.ts      (test rows are kept, never deleted)
import { restKf } from "./rest-kf";
import { kissflowConversations } from "../../src/services/kissflow/conversations";

const kf = restKf();
const svc = kissflowConversations(kf, () => undefined);
const tag = `[TEST ${new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "")}]`;
const now = new Date().toISOString();
let fails = 0;
const check = (name: string, ok: boolean, info = "") => { console.log(`${ok ? "✓" : "✗"} ${name}${info ? ` (${info})` : ""}`); if (!ok) fails++; };

const saved = await svc.save({
  sessionId: `${tag} conversation check`, startedAt: now, endedAt: now, durationSeconds: 70, lang: "ar", callerName: "Layla Al Suwaidi", callerRole: "Resident",
  voiceEngine: "Gemini Live", model: "gemini-3.8-live", workOrderRef: "WO-26-TEST", transcript: "[14:05:14] CAFM: مرحبا\n[14:05:20] Caller: المكيف لا يبرد", inputTokens: 100, outputTokens: 50, totalTokens: 150
});
check("save returns a Kissflow id", typeof saved.id === "string" && saved.id.length > 5, saved.id);
await svc.update(saved.id, { summary: "Test summary", keyPoints: ["point one", "point two"], sentiment: "neutral" });
const row = (await svc.list()).find((c) => c.id === saved.id);
check("row reads back", row !== undefined);
if (row !== undefined) {
  check("language round-trips (Arabic)", row.lang === "ar");
  check("Arabic transcript round-trips", row.transcript.includes("المكيف لا يبرد"));
  check("duration and tokens", row.durationSeconds === 70 && row.totalTokens === 150);
  check("summary update applied", row.summary === "Test summary" && row.sentiment === "neutral");
  check("key points list round-trips", JSON.stringify(row.keyPoints) === JSON.stringify(["point one", "point two"]), JSON.stringify(row.keyPoints));
}
console.log(fails === 0 ? "all passed" : `${fails} failed`);
process.exit(fails === 0 ? 0 : 1);
