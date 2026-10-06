import { describe, expect, it } from "vitest";
import { createDemoBrain } from "./mockBrain";
import type { VoiceContext, VoiceLine, VoiceSlots, VoiceTurnResult } from "./types";

const ctx: VoiceContext = { residentName: "Layla Al Suwaidi", unitLabel: "Apt 1402", siteName: "Qamar Residences", inDlp: true, lang: "en" };

async function run(lines: string[], lang: "en" | "ar" = "en") {
  const brain = createDemoBrain();
  const history: VoiceLine[] = [{ role: "agent", text: brain.greet({ ...ctx, lang }) }];
  let slots: VoiceSlots = {};
  const turns: VoiceTurnResult[] = [];
  for (const l of lines) {
    history.push({ role: "caller", text: l });
    let streamed = "";
    const r = await brain.respond({ history, slots, context: ctx, lang }, (d) => (streamed += d), new AbortController().signal);
    expect(streamed).toBe(r.say);
    history.push({ role: "agent", text: r.say });
    slots = r.slots;
    turns.push(r);
  }
  return turns;
}

describe("demo voice brain", () => {
  it("runs the English AC story to submit", async () => {
    const t = await run([
      "My AC is not working",
      "It's the living room, blowing warm air since this morning",
      "Yes, I have a small baby",
      "Now is fine, I'm home",
      "Yes please"
    ]);
    expect(t[0].slots.category).toBe("ac_not_cooling");
    expect(t[1].slots.room).toBe("living room");
    expect(t[1].slots.since).toBe("this morning");
    expect(t[2].slots.vulnerableOccupant).toBe(true);
    expect(t[3].stage).toBe("confirming");
    expect(t[3].say).toContain("nothing to pay");
    expect(t[3].say).not.toMatch(/vulnerable occupant|access:|—/);
    expect(t[4].stage).toBe("submit");
    expect(t[4].slots.summary).toContain("living room");
  });

  it("accepts a correction at the confirmation step", async () => {
    const t = await run(["AC not cooling", "blowing warm air in the living room", "since this morning", "no", "call first", "no, actually it's the bedroom", "yes"]);
    expect(t[5].slots.room).toBe("bedroom");
    expect(t[5].stage).toBe("confirming");
    expect(t[6].stage).toBe("submit");
  });

  it("runs in Arabic", async () => {
    const t = await run(["المكيف ما يبرد", "في الصالة، يطلع هواء حار من الصباح", "عندي طفل رضيع", "الحين، أنا موجودة", "نعم"], "ar");
    expect(t[0].lang).toBe("ar");
    expect(t[1].slots.room).toBe("living room");
    expect(t[2].slots.vulnerableOccupant).toBe(true);
    expect(t[4].stage).toBe("submit");
  });
});
