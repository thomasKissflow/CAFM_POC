// Dev-only voice brain proxy: the browser never sees the Anthropic key.
// Mounted by vite.config.ts as middleware on the dev server (not part of the Custom UI bundle).
//   GET  /api/voice/health -> { claude: boolean, model }
//   POST /api/voice/turn   -> text/event-stream: `delta` {text} … `result` {say, slots, stage, lang} | `error` {message}
// Phase 7 replaces this with a Google Cloud backend (see PLAN.md §Phase 7).
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { IncomingMessage, ServerResponse } from "node:http";

const CATEGORIES = ["ac_not_cooling", "ac_noise_leak", "water_leak", "electrical", "lift", "plumbing", "fire_life_safety", "civil_finishes", "doors_hardware", "structural_crack"] as const;
const STAGES = ["gathering", "confirming", "submit", "handoff"] as const;

const RecordInput = z.object({
  category: z.enum(CATEGORIES).optional(),
  symptom: z.string().optional(),
  room: z.string().optional(),
  since: z.string().optional(),
  vulnerable_occupant: z.boolean().optional(),
  safety_hazard: z.boolean().optional(),
  access: z.string().optional(),
  summary: z.string().optional(),
  stage: z.enum(STAGES),
  language: z.enum(["en", "ar"])
});

const TurnBody = z.object({
  history: z.array(z.object({ role: z.enum(["caller", "agent"]), text: z.string(), interrupted: z.boolean().optional() })).max(60),
  slots: z.record(z.string(), z.unknown()),
  context: z.object({ residentName: z.string(), unitLabel: z.string(), siteName: z.string(), inDlp: z.boolean(), lang: z.enum(["en", "ar"]) }),
  lang: z.enum(["en", "ar"])
});

// Stable system prompt (kept byte-identical across turns so it caches; volatile state goes in the last user turn).
const SYSTEM = `You are the CAFM voice assistant for residents of buildings built by Dutco Construction (demo). You are on a live phone-style voice call. Your job: understand the maintenance problem, ask short follow-up questions, confirm, and log a work order. The platform routes it to the right team automatically; you never promise a specific person.

How you speak:
- One or two short sentences per turn, natural and warm, like a helpful human on the phone. No lists, no markdown, no emoji.
- Ask one question at a time. Don't repeat what the caller already told you.
- Reply in the caller's language. If they speak Arabic, reply in clear Gulf-friendly Modern Standard Arabic.
- If the caller interrupted you, don't restart your previous sentence; respond to what they just said.

What to capture: the problem (category), the symptom, which room, since when, whether anyone vulnerable to heat is at home (baby, elderly, pregnant, unwell) for AC issues, any safety hazard (water near electrics, sparks, smoke), and when the technician can access the flat.
- Safety first: if there is a hazard, tell them to keep clear and switch off the isolator only if safe, and treat it as an emergency.
- If the context says the unit is inside the builder's defects liability period, you may say the repair is at no cost to them. Never invent reference numbers, prices, names or appointment times; the app reads those out after logging.
- When you have enough, read back a one-sentence summary and ask for confirmation (stage "confirming"). Only after the caller clearly agrees, use stage "submit" and say something brief like "Perfect, sending it now."
- If the caller asks for a human or the request is outside maintenance, use stage "handoff".

After you speak, ALWAYS call record_request exactly once with everything known so far (include earlier facts, not just new ones).`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "record_request",
    description: "Record the structured maintenance request as understood so far, and the conversation stage. Call once per turn, after speaking.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", enum: [...CATEGORIES] },
        symptom: { type: "string", description: "Short symptom in English, e.g. 'blowing warm air'" },
        room: { type: "string", description: "Room in English, e.g. 'living room'" },
        since: { type: "string", description: "When it started, in English" },
        vulnerable_occupant: { type: "boolean" },
        safety_hazard: { type: "boolean" },
        access: { type: "string", description: "When the technician can enter, in English" },
        summary: { type: "string", description: "One-sentence English summary for the work order" },
        stage: { type: "string", enum: [...STAGES] },
        language: { type: "string", enum: ["en", "ar"], description: "Language of your spoken reply" }
      },
      required: ["stage", "language"]
    }
  }
];

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 200_000) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function toMessages(body: z.infer<typeof TurnBody>): Anthropic.Beta.BetaMessageParam[] {
  const msgs: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: "(call connected)" }];
  for (const l of body.history) {
    const text = l.text.trim() || "…";
    msgs.push({ role: l.role === "caller" ? "user" : "assistant", content: l.role === "agent" && l.interrupted ? `${text} [interrupted by caller]` : text });
  }
  // Volatile state rides at the end of the latest user turn (keeps the system prompt cacheable).
  const { asked: _asked, ...known } = body.slots as Record<string, unknown>;
  const ctx = `[Context — not spoken by caller] Resident: ${body.context.residentName}, ${body.context.unitLabel}, ${body.context.siteName}. Unit inside builder's defects liability period: ${body.context.inDlp ? "yes" : "no"}. Captured so far: ${JSON.stringify(known)}.`;
  const last = msgs[msgs.length - 1];
  if (last.role === "user") msgs[msgs.length - 1] = { role: "user", content: `${String(last.content)}\n\n${ctx}` };
  else msgs.push({ role: "user", content: ctx });
  return msgs;
}

export function voiceProxy(apiKey: string | undefined, model: string) {
  const client = apiKey ? new Anthropic({ apiKey }) : null;

  return async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = req.url ?? "";
    if (url.startsWith("/api/voice/health") && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ claude: client !== null, model }));
      return;
    }
    if (!url.startsWith("/api/voice/turn") || req.method !== "POST") return next();

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    if (client === null) {
      send("error", { message: "ANTHROPIC_API_KEY is not configured on the dev server" });
      return res.end();
    }

    let body: z.infer<typeof TurnBody>;
    try {
      body = TurnBody.parse(JSON.parse(await readBody(req)));
    } catch (e) {
      send("error", { message: `bad request: ${(e as Error).message}` });
      return res.end();
    }

    const abort = new AbortController();
    res.on("close", () => abort.abort()); // caller barged in / hung up → stop generating

    try {
      const stream = client.beta.messages.stream(
        {
          model,
          max_tokens: 4096,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "low" }, // latency-sensitive conversational route
          system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
          tools: TOOLS,
          messages: toMessages(body)
        },
        { signal: abort.signal }
      );
      let spoken = "";
      stream.on("text", (delta) => {
        spoken += delta;
        send("delta", { text: delta });
      });
      const message = await stream.finalMessage();

      if (message.stop_reason === "refusal") {
        send("result", { say: spoken, slots: body.slots, stage: "handoff", lang: body.lang });
        return res.end();
      }
      const toolUse = message.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      const parsed = toolUse ? RecordInput.safeParse(toolUse.input) : null;
      if (message.stop_reason === "max_tokens" || parsed === null || !parsed.success) {
        // Keep what was spoken; slots unchanged. The client stays in "gathering" and the caller can continue.
        send("result", { say: spoken, slots: body.slots, stage: "gathering", lang: body.lang });
        return res.end();
      }
      const r = parsed.data;
      const slots = {
        ...body.slots,
        category: r.category ?? body.slots.category,
        symptom: r.symptom ?? body.slots.symptom,
        room: r.room ?? body.slots.room,
        since: r.since ?? body.slots.since,
        vulnerableOccupant: r.vulnerable_occupant ?? body.slots.vulnerableOccupant,
        safetyHazard: r.safety_hazard ?? body.slots.safetyHazard,
        access: r.access ?? body.slots.access,
        summary: r.summary ?? body.slots.summary
      };
      send("result", { say: spoken, slots, stage: r.stage, lang: r.language });
    } catch (e) {
      if (abort.signal.aborted) return res.end();
      if (e instanceof Anthropic.AuthenticationError) send("error", { message: "Anthropic API key rejected" });
      else if (e instanceof Anthropic.RateLimitError) send("error", { message: "Rate limited — try again in a moment" });
      else if (e instanceof Anthropic.APIError) send("error", { message: `Claude API error ${e.status}` });
      else send("error", { message: "Voice brain unavailable" });
    }
    res.end();
  };
}
