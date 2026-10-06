// AI Conversations ↔ Kissflow dataform CAFM_AI_Conversation_A00 (one row per voice call; the summarizer and
// insights fill the later sections of the same row).
import type { AiConversation, ConversationService } from "@/services/types";
import { FLOW } from "./ids";
import { isoDate, kfDateTime, listAll, num, str, type Kf, type KfRow } from "./sdk";

const LANG_TO_KF = { en: "English", ar: "Arabic" } as const;
const lines = (v: string[] | undefined) => (v === undefined ? undefined : v.map((x) => `• ${x}`).join("\n"));
const unlines = (v: unknown) => { const s = str(v); return s === undefined ? undefined : s.split("\n").map((x) => x.replace(/^•\s*/, "").trim()).filter((x) => x !== ""); };

function toRow(c: Partial<Omit<AiConversation, "id">>, woInstance: (appId: string) => string | undefined): Record<string, unknown> {
  const row: Record<string, unknown> = {
    Session_Id: c.sessionId, Started_At: c.startedAt !== undefined ? kfDateTime(c.startedAt) : undefined, Ended_At: c.endedAt !== undefined ? kfDateTime(c.endedAt) : undefined,
    Duration_Seconds: c.durationSeconds, Language: c.lang !== undefined ? LANG_TO_KF[c.lang] : undefined, Caller_Name: c.callerName, Caller_Role: c.callerRole,
    Voice_Engine: c.voiceEngine, Model: c.model, Work_Order_Ref: c.workOrderRef,
    Work_Order_Instance: c.workOrderId !== undefined ? woInstance(c.workOrderId) : undefined, Transcript: c.transcript,
    Summary: c.summary, Key_Points: lines(c.keyPoints), Action_Items: lines(c.actionItems), Open_Questions: lines(c.openQuestions),
    Sentiment: c.sentiment, Intents: lines(c.intents), Issues_Raised: lines(c.issuesRaised), Suggested_Follow_Ups: lines(c.suggestedFollowUps), Insights_JSON: c.insightsJson,
    Input_Tokens: c.inputTokens, Output_Tokens: c.outputTokens, Total_Tokens: c.totalTokens
  };
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

export function fromRow(r: KfRow): AiConversation {
  return {
    id: r._id, sessionId: str(r.Session_Id) ?? r._id, startedAt: isoDate(r.Started_At) ?? isoDate(r._created_at) ?? new Date(0).toISOString(), endedAt: isoDate(r.Ended_At),
    durationSeconds: num(r.Duration_Seconds), lang: r.Language === "Arabic" ? "ar" : "en", callerName: str(r.Caller_Name), callerRole: str(r.Caller_Role),
    voiceEngine: str(r.Voice_Engine) ?? "", model: str(r.Model), workOrderRef: str(r.Work_Order_Ref), transcript: str(r.Transcript) ?? "",
    summary: str(r.Summary), keyPoints: unlines(r.Key_Points), actionItems: unlines(r.Action_Items), openQuestions: unlines(r.Open_Questions),
    sentiment: str(r.Sentiment), intents: unlines(r.Intents), issuesRaised: unlines(r.Issues_Raised), suggestedFollowUps: unlines(r.Suggested_Follow_Ups), insightsJson: str(r.Insights_JSON),
    inputTokens: num(r.Input_Tokens), outputTokens: num(r.Output_Tokens), totalTokens: num(r.Total_Tokens)
  };
}

export function kissflowConversations(kf: Kf, woInstance: (appId: string) => string | undefined): ConversationService {
  const form = () => kf.app.getDataform(FLOW.aiConversation);
  return {
    async list() { return (await listAll(form(), "AI conversations")).map(fromRow).sort((a, b) => b.startedAt.localeCompare(a.startedAt)); },
    async save(c) {
      const created = await form().createItem({ data: toRow(c, woInstance) });
      if (created === undefined || created === null || typeof created._id !== "string") throw new Error("Kissflow did not return the saved conversation");
      return { ...c, id: created._id };
    },
    async update(id, patch) {
      const updated = await form().updateItem({ itemId: id, data: toRow(patch, woInstance) });
      return fromRow({ ...(updated !== undefined && updated !== null ? updated : {}), _id: id } as KfRow);
    }
  };
}
