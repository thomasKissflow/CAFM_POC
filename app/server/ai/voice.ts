// Mints the Live voice token on the server (the browser-side twin lives in src/ai/). The session shape itself
// is shared: see shared/ai-core.ts for what the token locks and why tools/resumption stay with the client.
import type { LiveTokenRequest, LiveTokenResponse } from "../../shared/ai-types";
import { mintToken } from "../../shared/ai-core";
import { AI } from "./config";
import { geminiClient, logUsage, withRetry } from "./gemini";
import { getSettings } from "./settings";

export async function mintLiveToken(req: LiveTokenRequest): Promise<LiveTokenResponse> {
  const settings = await getSettings();
  const client = geminiClient(AI.liveApiVersion);
  const t = await withRetry("live-token", () => mintToken(client, {
    model: AI.liveModel, prompt: settings.voiceSystemPrompt, lang: req.lang, caller: req.caller, voiceName: AI.voiceName,
    uses: AI.token.uses, newSessionSeconds: AI.token.newSessionSeconds, expireMinutes: AI.token.expireMinutes
  }));
  logUsage("live-token", { model: AI.liveModel }, { user: req.userId.slice(0, 24), lang: req.lang });
  return { token: t.token, model: AI.liveModel, apiVersion: AI.liveApiVersion, expiresAt: t.expiresAt, newSessionBy: t.newSessionBy, voiceName: AI.voiceName };
}
