// The AI calls themselves, written once and used from both sides:
//   • the backend (local dev / Cloud Run), where the key is in process.env
//   • the browser inside Kissflow (POC only), where the key comes from the Kissflow "AI Settings" row
// Nothing here reads a key: the caller passes a ready GoogleGenAI client.
import { Modality, Type, type GoogleGenAI, type LiveConnectConfig, type Schema } from "@google/genai";
import type { AiResponse, CallerContext, InsightsRequest, InsightsResult, SummarizeRequest, SummaryResult, UsageNote } from "./ai-types";
import { RECORD_REQUEST } from "./voice-tool";

export const AI_DEFAULTS: { liveModel: string; textModel: string; voiceName: string; liveApiVersion: string } =
  { liveModel: "gemini-3.8-live", textModel: "gemini-3.8-flash", voiceName: "Kore", liveApiVersion: "v1alpha" };

// ---- live voice session -------------------------------------------------------------------------
const clip = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.replace(/[\r\n]+/g, " ").slice(0, 60) : undefined);

/** The caller's details, added to the prompt for this call only. */
export function contextBlock(lang: "en" | "ar", c: CallerContext | undefined): string {
  const lines = [`Caller's app language: ${lang === "ar" ? "Arabic" : "English"} (greet them in it).`];
  if (c !== undefined) {
    const name = clip(c.residentName), unit = clip(c.unitLabel), site = clip(c.siteName);
    if (name !== undefined) lines.push(`Caller: ${name} (resident).`);
    if (unit !== undefined || site !== undefined) lines.push(`Unit: ${[unit, site].filter((x) => x !== undefined).join(", ")}.`);
    if (c.inDlp === true) lines.push("This unit is inside the builder's defects period: AC and fit-out repairs are at no cost to the resident.");
  }
  return `\n\nContext for this call:\n- ${lines.join("\n- ")}`;
}

/** What the ephemeral token locks: model, prompt, voice, transcription, compression.
 *  `tools` and `sessionResumption` are deliberately left out — a token carrying tools is rejected by the API
 *  (invalid field mask), and locking sessionResumption stops a dropped call from resuming (verified 22 Sep). */
export function liveSessionConfig(prompt: string, lang: "en" | "ar", caller: CallerContext | undefined, voiceName = AI_DEFAULTS.voiceName): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: prompt + contextBlock(lang, caller),
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    contextWindowCompression: { slidingWindow: {} }
  };
}

/** What the browser adds when it connects (see above for why these can't be in the token). */
export const liveClientConfig = (resumeHandle?: string) => ({
  responseModalities: [Modality.AUDIO],
  tools: [{ functionDeclarations: [RECORD_REQUEST] }],
  sessionResumption: resumeHandle !== undefined ? { handle: resumeHandle } : {}
});

export interface TokenOptions { model: string; prompt: string; lang: "en" | "ar"; caller?: CallerContext; voiceName?: string; uses?: number; newSessionSeconds?: number; expireMinutes?: number }

/** Mints a single-use Live token. Same code server-side and (POC only) in the browser. */
export async function mintToken(ai: GoogleGenAI, o: TokenOptions): Promise<{ token: string; expiresAt: string; newSessionBy: string }> {
  const now = Date.now();
  const expiresAt = new Date(now + (o.expireMinutes ?? 30) * 60_000).toISOString();
  const newSessionBy = new Date(now + (o.newSessionSeconds ?? 60) * 1000).toISOString();
  const t = await ai.authTokens.create({
    config: {
      uses: o.uses ?? 1, expireTime: expiresAt, newSessionExpireTime: newSessionBy,
      liveConnectConstraints: { model: o.model, config: liveSessionConfig(o.prompt, o.lang, o.caller, o.voiceName) },
      lockAdditionalFields: []
    }
  });
  if (t.name === undefined) throw new Error("Gemini returned no token");
  return { token: t.name, expiresAt, newSessionBy };
}

// ---- summary and insights (structured output) ---------------------------------------------------
const str = { type: Type.STRING } as Schema;
const list = (description: string) => ({ type: Type.ARRAY, description, items: str }) as Schema;

export const SUMMARY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Two or three sentences: what the caller needed and what was agreed. Plain English." },
    keyPoints: list("The facts a maintenance manager needs: problem, room, since when, access, anything about the occupant."),
    actionItems: list("What someone must now do, each starting with a verb."),
    openQuestions: list("Anything left unclear or unanswered on the call. Empty if none.")
  },
  required: ["summary", "keyPoints", "actionItems", "openQuestions"]
};

export const INSIGHTS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    sentiment: { type: Type.STRING, enum: ["positive", "neutral", "negative", "mixed"], description: "How the caller sounded overall." },
    sentimentReason: { type: Type.STRING, description: "One short sentence of evidence from the call." },
    intents: list("What the caller wanted, in two or three words each, e.g. 'report AC fault', 'chase earlier request'."),
    topics: list("Subjects raised, e.g. 'cooling', 'noise', 'billing'."),
    issuesRaised: {
      type: Type.ARRAY, description: "Problems worth a manager's attention, including repeat faults and anything about safety or vulnerable occupants.",
      items: { type: Type.OBJECT, properties: { issue: str, severity: { type: Type.STRING, enum: ["low", "medium", "high"] } }, required: ["issue", "severity"] }
    },
    suggestedFollowUps: list("Concrete follow-ups for the FM team, each one sentence.")
  },
  required: ["sentiment", "sentimentReason", "intents", "topics", "issuesRaised", "suggestedFollowUps"]
};

const CONTEXT = "You are helping a facilities-management team in Dubai. The call is between a resident and an AI maintenance assistant. Work only from the transcript: never invent facts, names, prices or times. Answer in English even when the call was in Arabic.";

const usageOf = (model: string, u: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined): UsageNote =>
  ({ model, inputTokens: u?.promptTokenCount, outputTokens: u?.candidatesTokenCount, totalTokens: u?.totalTokenCount });

async function structured<T>(ai: GoogleGenAI, model: string, prompt: string, schema: Schema): Promise<AiResponse<T>> {
  const r = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 } });
  const text = r.text;
  if (text === undefined || text.trim() === "") throw new Error("Gemini returned an empty answer");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error("Gemini returned an answer that isn't valid JSON"); }
  return { result: parsed as T, usage: usageOf(model, r.usageMetadata) };
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);

export async function summarize(ai: GoogleGenAI, model: string, req: SummarizeRequest): Promise<AiResponse<SummaryResult>> {
  const prompt = `${CONTEXT}\n\nSummarise this call for the work order.${req.context !== undefined ? `\nAbout this call: ${req.context}` : ""}\n\nTranscript:\n${req.text.slice(0, 20000)}`;
  const r = await structured<SummaryResult>(ai, model, prompt, SUMMARY_SCHEMA);
  const s = r.result;
  return { ...r, result: { summary: typeof s.summary === "string" ? s.summary : "", keyPoints: strings(s.keyPoints), actionItems: strings(s.actionItems), openQuestions: strings(s.openQuestions) } };
}

const SENTIMENTS = new Set(["positive", "neutral", "negative", "mixed"]);
const SEVERITIES = new Set(["low", "medium", "high"]);

export async function insights(ai: GoogleGenAI, model: string, req: InsightsRequest): Promise<AiResponse<InsightsResult>> {
  const prompt = `${CONTEXT}\n\nRead this call and report what the FM team should know.${req.context !== undefined ? `\nAbout this call: ${req.context}` : ""}\n\nTranscript:\n${req.text.slice(0, 20000)}`;
  const r = await structured<InsightsResult>(ai, model, prompt, INSIGHTS_SCHEMA);
  const i = r.result;
  const raised = Array.isArray(i.issuesRaised) ? i.issuesRaised : [];
  return {
    ...r,
    result: {
      sentiment: typeof i.sentiment === "string" && SENTIMENTS.has(i.sentiment) ? i.sentiment : "neutral",
      sentimentReason: typeof i.sentimentReason === "string" ? i.sentimentReason : "",
      intents: strings(i.intents), topics: strings(i.topics),
      issuesRaised: raised.filter((x) => x !== null && typeof x === "object" && typeof x.issue === "string")
        .map((x) => ({ issue: x.issue, severity: SEVERITIES.has(x.severity) ? x.severity : "low" })),
      suggestedFollowUps: strings(i.suggestedFollowUps)
    }
  };
}
