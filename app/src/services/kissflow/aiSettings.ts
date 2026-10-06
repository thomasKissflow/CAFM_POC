// AI Settings rows in Kissflow (CAFM_AI_Setting_A00), read/written through the SDK as the signed-in user.
// POC only: the Gemini key can live here so the Custom UI can call Gemini with no server of our own.
// Only app admins can open this dataform; in production the key moves to the server (PRODUCTION_TODO.md).
import type { KfRow } from "./sdk";
import { listAll, kfDateTime, str, type Kf } from "./sdk";
import { FLOW } from "./ids";

export const KEY_PROMPT = "voice_system_prompt";
export const KEY_GEMINI = "gemini_api_key";
export const KEY_CLIENT_NAME = "client_name";
export const KEY_CLIENT_LOGO = "client_logo";
export const KEY_ACCENT = "brand_accent";

export interface AiSettingsService {
  /** The stored rows. `geminiKey` is undefined when no key is stored. */
  read(): Promise<{ voiceSystemPrompt?: string; geminiKey?: string; clientName?: string; clientLogo?: string; brandAccent?: string; updatedBy?: string; updatedAt?: string }>;
  write(key: string, value: string, by: string): Promise<void>;
}

export function kissflowAiSettings(kf: Kf): AiSettingsService {
  const form = () => kf.app.getDataform(FLOW.aiSetting);
  const rows = async (): Promise<KfRow[]> => listAll(form(), "AI settings", 100);
  return {
    async read() {
      const all = await rows();
      const find = (k: string) => all.find((r) => r.Setting_Key === k);
      const prompt = find(KEY_PROMPT), key = find(KEY_GEMINI);
      const value = (k: string) => { const row = find(k); return row !== undefined ? str(row.Setting_Value) : undefined; };
      return {
        voiceSystemPrompt: prompt !== undefined ? str(prompt.Setting_Value) : undefined,
        geminiKey: key !== undefined ? str(key.Setting_Value) : undefined,
        clientName: value(KEY_CLIENT_NAME),
        clientLogo: value(KEY_CLIENT_LOGO),
        brandAccent: value(KEY_ACCENT),
        updatedBy: prompt !== undefined ? str(prompt.Updated_By) : undefined,
        updatedAt: prompt !== undefined ? str(prompt.Updated_At) : undefined
      };
    },
    async write(key, value, by) {
      const existing = (await rows()).find((r) => r.Setting_Key === key);
      const data = { Setting_Key: key, Setting_Value: value, Updated_By: by, Updated_At: kfDateTime(new Date().toISOString()) };
      if (existing !== undefined) await form().updateItem({ itemId: existing._id, data });
      else await form().createItem({ data });
    }
  };
}

/** Demo data: settings kept in memory for this session only, never a real key. */
export function memoryAiSettings(): AiSettingsService {
  const store = new Map<string, { value: string; by: string; at: string }>();
  return {
    async read() {
      const p = store.get(KEY_PROMPT), k = store.get(KEY_GEMINI);
      const v = (key: string) => { const row = store.get(key); return row !== undefined ? row.value : undefined; };
      return {
        voiceSystemPrompt: p !== undefined ? p.value : undefined, geminiKey: k !== undefined ? k.value : undefined,
        clientName: v(KEY_CLIENT_NAME), clientLogo: v(KEY_CLIENT_LOGO), brandAccent: v(KEY_ACCENT),
        updatedBy: p !== undefined ? p.by : undefined, updatedAt: p !== undefined ? p.at : undefined
      };
    },
    async write(key, value, by) { store.set(key, { value, by, at: new Date().toISOString() }); }
  };
}
