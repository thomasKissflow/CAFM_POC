// End-to-end AI check that runs wherever the app runs (including inside Kissflow, where there is no microphone
// for an automated test): token → live session with typed input → tool call → summary → insights → saved call row.
// It writes one [TEST] conversation row and never deletes anything.
import { Modality } from "@google/genai";
import type { Services } from "@/services/types";
import { liveClientConfig } from "../../shared/ai-core";
import type { AiProvider } from "./provider";

export interface AiStep { name: string; ok: boolean; detail: string }

const SAMPLE = [
  "[10:00] CAFM: Hello, how can I help with your apartment today?",
  "[10:00] Caller: The air conditioning in the living room has been blowing warm air since last night, and my baby is at home.",
  "[10:01] CAFM: I'm sorry. When can a technician come in?",
  "[10:01] Caller: Any time today, I'm home. This is the second time this month.",
  "[10:02] CAFM: Thank you, I've logged it and the team will call you before three."
].join("\n");

export async function runAiSelfTest(provider: AiProvider, services: Services, onStep?: (s: AiStep) => void): Promise<AiStep[]> {
  const steps: AiStep[] = [];
  const add = (name: string, ok: boolean, detail: string) => { const s = { name, ok, detail }; steps.push(s); if (onStep !== undefined) onStep(s); return s; };

  add("AI available", provider.mode !== "off", provider.mode === "backend" ? "through our AI service" : provider.mode === "browser" ? "from this page, with the key stored in Kissflow" : (provider.reason ?? "not available"));
  if (provider.mode === "off") return steps;

  // 1. token
  let token: Awaited<ReturnType<AiProvider["liveToken"]>> | undefined;
  try {
    token = await provider.liveToken({ userId: "self-test", lang: "en", caller: { residentName: "Layla Al Suwaidi", unitLabel: "Apt 1402", siteName: "Qamar Residences", inDlp: true } });
    add("Voice token", true, `${token.model} · single use · valid until ${token.expiresAt.slice(11, 16)} UTC`);
  } catch (e) { add("Voice token", false, e instanceof Error ? e.message : String(e)); return steps; }

  // 2. live session: type one sentence, expect the agent to answer and to fill the job card through its tool
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: token.apiVersion } });
    const seen = { audio: 0, said: "", tool: undefined as Record<string, unknown> | undefined, err: undefined as string | undefined };
    let stop = () => undefined as void;
    const ended = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 25000);
      stop = () => { clearTimeout(timer); resolve(); };
    });
    const session = await ai.live.connect({
      model: token.model,
      config: { ...liveClientConfig(), responseModalities: [Modality.AUDIO] },
      callbacks: {
        onmessage: (m) => {
          if (m.toolCall !== undefined && m.toolCall.functionCalls !== undefined) {
            seen.tool = (m.toolCall.functionCalls[0].args ?? {}) as Record<string, unknown>;
            session.sendToolResponse({ functionResponses: m.toolCall.functionCalls.map((f) => ({ id: f.id, name: f.name, response: { ok: true } })) });
          }
          const sc = m.serverContent;
          if (sc === undefined) return;
          if (sc.outputTranscription !== undefined && typeof sc.outputTranscription.text === "string") seen.said += sc.outputTranscription.text;
          for (const p of sc.modelTurn !== undefined && sc.modelTurn.parts !== undefined ? sc.modelTurn.parts : []) if (p.inlineData !== undefined && typeof p.inlineData.data === "string") seen.audio += p.inlineData.data.length;
          if (sc.turnComplete === true && seen.audio > 0 && seen.tool !== undefined) stop();
        },
        onerror: (e) => { seen.err = (e as ErrorEvent).message ?? "connection error"; stop(); },
        onclose: (e) => { if (e.code !== 1000 && seen.audio === 0) seen.err = `closed ${e.code}`; stop(); }
      }
    });
    session.sendRealtimeInput({ text: "The AC in my living room is blowing warm air since last night." });
    await ended;
    try { session.close(); } catch { /* already closed */ }
    add("Live voice session", seen.err === undefined && seen.audio > 0, seen.err !== undefined ? seen.err : `${Math.round(seen.audio * 0.75 / 1024)} kB of speech · "${seen.said.slice(0, 60)}"`);
    add("Job card from the call", seen.tool !== undefined, seen.tool !== undefined ? Object.keys(seen.tool).join(", ") : "the agent did not call record_request");
  } catch (e) { add("Live voice session", false, e instanceof Error ? e.message : String(e)); }

  // 3. summary and insights
  let summaryOk = false;
  try {
    const s = await provider.summarize({ text: SAMPLE, lang: "en" });
    summaryOk = s.result.summary.length > 20 && s.result.keyPoints.length > 0;
    add("Summary", summaryOk, `${s.result.keyPoints.length} key points, ${s.result.actionItems.length} actions · ${s.usage.totalTokens ?? 0} tokens`);
  } catch (e) { add("Summary", false, e instanceof Error ? e.message : String(e)); }
  try {
    const i = await provider.insights({ text: SAMPLE, lang: "en" });
    add("Insights", i.result.intents.length > 0 || i.result.issuesRaised.length > 0, `${i.result.sentiment} · ${i.result.issuesRaised.length} issues · ${i.result.suggestedFollowUps.length} follow-ups`);
  } catch (e) { add("Insights", false, e instanceof Error ? e.message : String(e)); }

  // 4. the call record, saved where every call is saved
  try {
    const now = new Date().toISOString();
    const saved = await services.conversations.save({
      sessionId: `[TEST] ai-self-test ${now.slice(5, 16)}`, startedAt: now, endedAt: now, durationSeconds: 0, lang: "en",
      callerName: "Self-test", callerRole: "Admin", voiceEngine: `self-test (${provider.mode})`, model: provider.liveModel, transcript: SAMPLE
    });
    const back = (await services.conversations.list()).find((c) => c.id === saved.id);
    add("Call saved", back !== undefined, back !== undefined ? `kept as ${back.sessionId}` : "the saved row could not be read back");
  } catch (e) { add("Call saved", false, e instanceof Error ? e.message : String(e)); }

  return steps;
}
