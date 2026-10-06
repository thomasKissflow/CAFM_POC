// AI settings persisted in Kissflow ("AI Settings" dataform, CAFM_AI_Setting_A00), cached briefly.
import type { AiSettings } from "../../shared/ai-types";
import { kfConfigured, kfRest } from "../kf/rest";
import { AI } from "./config";

const FORM = "CAFM_AI_Setting_A00", Q = "?_application_id=CAFM_POC_A00";
const KEY_PROMPT = "voice_system_prompt";
let cache: { at: number; value: AiSettings } | undefined;

async function rows(): Promise<Array<Record<string, unknown>>> {
  const r = await kfRest("POST", `/form/2/{acc}/${FORM}/allitems/list${Q}&page_size=100&page_number=1`, {});
  const data = r.json !== null && typeof r.json === "object" ? (r.json as { Data?: unknown }).Data : undefined;
  return Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
}

export async function getSettings(): Promise<AiSettings> {
  if (cache !== undefined && Date.now() - cache.at < 30_000) return cache.value;
  let value: AiSettings = { voiceSystemPrompt: AI.defaultVoicePrompt };
  if (kfConfigured()) {
    const row = (await rows()).find((r) => r.Setting_Key === KEY_PROMPT);
    if (row !== undefined && typeof row.Setting_Value === "string" && row.Setting_Value.trim() !== "")
      value = { voiceSystemPrompt: row.Setting_Value, updatedBy: typeof row.Updated_By === "string" ? row.Updated_By : undefined, updatedAt: typeof row.Updated_At === "string" ? row.Updated_At : undefined };
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function saveVoicePrompt(prompt: string, by: string): Promise<AiSettings> {
  if (!kfConfigured()) throw new Error("Kissflow keys are not configured on the server");
  const existing = (await rows()).find((r) => r.Setting_Key === KEY_PROMPT);
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const row = { Setting_Key: KEY_PROMPT, Setting_Value: prompt, Updated_By: by, Updated_At: now };
  const r = await kfRest("POST", `/form/2/{acc}/${FORM}/batch${Q}`, [existing !== undefined ? { _id: existing._id, ...row } : { ...row, _is_created: true }]);
  if (r.status >= 300) throw new Error(`Kissflow refused the setting (${r.status})`);
  cache = undefined;
  return getSettings();
}
