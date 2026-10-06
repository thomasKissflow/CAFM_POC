// Claude brain: talks to the dev-server proxy (server/voiceProxy.ts), which holds the API key.
// Only available under `npm run dev` with ANTHROPIC_API_KEY set; otherwise the demo brain is used.
import type { VoiceBrain, VoiceContext, VoiceTurnResult } from "./types";

export async function claudeAvailable(): Promise<{ ok: boolean; model?: string }> {
  try {
    const r = await fetch("/api/voice/health", { method: "GET" });
    if (!r.ok) return { ok: false };
    const j = (await r.json()) as { claude?: boolean; model?: string };
    return { ok: j.claude === true, model: j.model };
  } catch {
    return { ok: false };
  }
}

export function createClaudeBrain(greetFallback: (ctx: VoiceContext) => string): VoiceBrain {
  return {
    id: "claude",
    greet: greetFallback,
    async respond(input, onText, signal): Promise<VoiceTurnResult> {
      const r = await fetch("/api/voice/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal
      });
      if (!r.ok || r.body === null) throw new Error(`voice proxy HTTP ${r.status}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let result: VoiceTurnResult | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const ev = /^event: (.+)$/m.exec(frame)?.[1];
          const data = /^data: (.+)$/m.exec(frame)?.[1];
          if (ev === undefined || data === undefined) continue;
          const payload = JSON.parse(data) as Record<string, unknown>;
          if (ev === "delta") onText(String(payload.text ?? ""));
          else if (ev === "result") result = payload as unknown as VoiceTurnResult;
          else if (ev === "error") throw new Error(String(payload.message ?? "voice brain error"));
        }
      }
      if (result === null) throw new Error("voice brain ended without a result");
      return result;
    }
  };
}
