// Demo brain: a deterministic slot-filling dialogue (EN/AR). Runs offline, identical every demo.
import type { Lang } from "@/domain/types";
import { absorb, langOf, saysNo, saysYes } from "./nlu";
import type { VoiceBrain, VoiceContext, VoiceSlots, VoiceTurnInput, VoiceTurnResult } from "./types";

const CATEGORY_LABEL: Record<string, { en: string; ar: string }> = {
  ac_not_cooling: { en: "AC not cooling", ar: "المكيف لا يبرد" },
  ac_noise_leak: { en: "AC leaking or noisy", ar: "تسريب أو صوت من المكيف" },
  water_leak: { en: "water leak", ar: "تسرب مياه" },
  electrical: { en: "electrical fault", ar: "عطل كهربائي" },
  lift: { en: "lift fault", ar: "عطل في المصعد" },
  plumbing: { en: "plumbing problem", ar: "مشكلة سباكة" },
  fire_life_safety: { en: "fire alarm fault", ar: "عطل في إنذار الحريق" },
  doors_hardware: { en: "door or lock problem", ar: "مشكلة باب أو قفل" },
  civil_finishes: { en: "finishing defect", ar: "عيب في التشطيب" }
};
export const AR_ROOM: Record<string, string> = { "living room": "الصالة", bedroom: "غرفة النوم", kitchen: "المطبخ", bathroom: "الحمام", majlis: "المجلس", "whole apartment": "الشقة كلها" };
export const AR_SINCE: Record<string, string> = { "this morning": "منذ الصباح", "last night": "منذ الليلة الماضية", yesterday: "منذ أمس", "a few hours": "منذ ساعات", "a few days": "منذ أيام", "just now": "من قليل" };
export const AR_ACCESS: Record<string, string> = { "now — resident at home": "الآن، الساكنة في المنزل", "call before coming": "الاتصال قبل الحضور", "this evening": "هذا المساء", tomorrow: "غدًا" };
export const AR_SYMPTOM: Record<string, string> = { "blowing warm air": "يخرج هواء حار", "not cooling at all": "لا يبرد أبدًا", "weak cooling": "تبريده ضعيف", "water dripping": "يسرب ماء", "making noise": "يصدر صوتًا" };

/** Slot value as the caller should see it on the job card. */
export function slotLabel(kind: "room" | "since" | "access" | "symptom", v: string | undefined, lang: Lang): string | undefined {
  if (v === undefined) return undefined;
  if (lang === "ar") return ({ room: AR_ROOM, since: AR_SINCE, access: AR_ACCESS, symptom: AR_SYMPTOM }[kind][v] ?? v);
  if (kind === "access" && v === "now — resident at home") return "Now, I'm home";
  if (kind === "since" && v.startsWith("a few")) return `For ${v}`;
  if (kind === "since" && /^(this|last|yesterday)/.test(v)) return `Since ${v}`;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export function summaryOf(s: VoiceSlots, lang: Lang, ctx: VoiceContext): string {
  const cat = s.category ? CATEGORY_LABEL[s.category]?.[lang] ?? s.category : lang === "ar" ? "مشكلة" : "a problem";
  if (lang === "ar") {
    return [
      `${cat}${s.room ? ` في ${AR_ROOM[s.room] ?? s.room}` : ""}`,
      s.symptom ? AR_SYMPTOM[s.symptom] ?? s.symptom : "",
      s.since ? AR_SINCE[s.since] ?? s.since : "",
      s.vulnerableOccupant ? "يوجد شخص حساس للحرارة في المنزل" : "",
      s.safetyHazard ? "خطر محتمل على السلامة" : "",
      s.access ? `الدخول: ${AR_ACCESS[s.access] ?? s.access}` : ""
    ].filter(Boolean).join("، ") + ` — ${ctx.unitLabel.replace("Apt", "شقة")}، ${ctx.siteName}`;
  }
  return [
    `${cat}${s.room ? ` in the ${s.room}` : ""}`,
    s.symptom ?? "",
    s.since ? `since ${s.since}` : "",
    s.vulnerableOccupant ? "vulnerable occupant at home" : "",
    s.safetyHazard ? "possible safety hazard" : "",
    s.access ? `access: ${s.access}` : ""
  ].filter(Boolean).join(", ") + ` — ${ctx.unitLabel}, ${ctx.siteName}`;
}

// ---- spoken phrasing (kept separate from summaryOf, which is the formal WO description) ----
const EN_SYM_LONG: Record<string, string> = { "blowing warm air": "has been blowing warm air", "not cooling at all": "hasn't been cooling at all", "weak cooling": "has been barely cooling", "water dripping": "has been dripping water", "making noise": "has been making a noise" };
const EN_SYM_SHORT: Record<string, string> = { "blowing warm air": "warm air", "not cooling at all": "no cooling at all", "weak cooling": "weak cooling", "water dripping": "dripping water", "making noise": "a noise" };
const EN_SINCE: Record<string, string> = { "this morning": "since this morning", "last night": "since last night", yesterday: "since yesterday", "a few hours": "for a few hours", "a few days": "for a few days", "just now": "for the last few minutes" };
const AR_SYM_SPOKEN: Record<string, string> = { "blowing warm air": "يطلع هواء حار", "not cooling at all": "ما يبرد أبدًا", "weak cooling": "تبريده ضعيف", "water dripping": "يقطّر ماء", "making noise": "يطلع صوت" };
const AR_SINCE_SPOKEN: Record<string, string> = { "this morning": "من الصباح", "last night": "من البارحة بالليل", yesterday: "من أمس", "a few hours": "من كم ساعة", "a few days": "من كم يوم", "just now": "من دقايق" };

const isAcCat = (s: VoiceSlots) => s.category === "ac_not_cooling" || s.category === "ac_noise_leak";
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const enSince = (v: string) => EN_SINCE[v] ?? `starting ${v}`;
const arRoom = (v: string) => AR_ROOM[v] ?? v;

/** Who the caller said is at home, in the words a person would use back to them. */
function vulnerableWho(text: string, ar: boolean): string {
  const t = text.toLowerCase();
  if (/baby|newborn|infant|child|kid|رضيع|طفل|بيبي/.test(t)) return ar ? "طفل صغير" : "a little one";
  if (/elder|old|grand|كبير|كبيرة|جد/.test(t)) return ar ? "كبير في السن" : "someone elderly";
  if (/pregnan|حامل/.test(t)) return ar ? "حامل" : "someone pregnant";
  return ar ? "أحد يحتاج رعاية" : "someone who needs extra care";
}

/** Natural read-back before submitting (EN). */
function readBackEn(s: VoiceSlots, ctx: VoiceContext, who: string | undefined): string {
  const cat = s.category ? CATEGORY_LABEL[s.category]?.en ?? "problem" : "problem";
  let what: string;
  if (isAcCat(s)) {
    what = `the ${s.room && s.room !== "whole apartment" ? `${s.room} ` : ""}AC ${s.symptom ? EN_SYM_LONG[s.symptom] ?? s.symptom : "isn't working properly"}${s.since ? ` ${enSince(s.since)}` : ""}`;
    if (s.room === "whole apartment") what += " all over the flat";
  } else {
    what = `there's a ${cat}${s.room ? ` in the ${s.room}` : ""}${s.since ? `, ${enSince(s.since)}` : ""}`;
  }
  const bits = [what];
  if (s.vulnerableOccupant) bits.push(`there's ${who ?? "someone vulnerable"} at home`);
  if (s.safetyHazard) bits.push("there may be a safety risk");
  if (s.access === "now — resident at home") bits.push("someone can come in now");
  else if (s.access === "call before coming") bits.push("they'll call you before coming");
  else if (s.access) bits.push(`they can come ${s.access}`);
  const list = bits.length > 1 ? `${bits.slice(0, -1).join(", ")}, and ${bits[bits.length - 1]}` : bits[0];
  const cost = ctx.inDlp && isAcCat(s) ? " Your flat's still inside the builder's defects period, so there's nothing to pay." : "";
  return `So, just to check: ${list}.${cost} Shall I send someone over?`;
}

/** Natural read-back before submitting (AR, addressing a female caller as in the demo story). */
function readBackAr(s: VoiceSlots, ctx: VoiceContext, who: string | undefined): string {
  const cat = s.category ? CATEGORY_LABEL[s.category]?.ar ?? "مشكلة" : "مشكلة";
  const what = isAcCat(s)
    ? `مكيف ${s.room ? arRoom(s.room) : ""} ${s.symptom ? AR_SYM_SPOKEN[s.symptom] ?? s.symptom : "فيه مشكلة"}${s.since ? ` ${AR_SINCE_SPOKEN[s.since] ?? s.since}` : ""}`.replace(/\s+/g, " ")
    : `${cat}${s.room ? ` في ${arRoom(s.room)}` : ""}${s.since ? ` ${AR_SINCE_SPOKEN[s.since] ?? s.since}` : ""}`;
  const bits = [what];
  if (s.vulnerableOccupant) bits.push(`وعندك ${who ?? "أحد يحتاج رعاية"} بالبيت`);
  if (s.safetyHazard) bits.push("وفيه خطر محتمل على السلامة");
  if (s.access === "now — resident at home") bits.push("والفني يقدر يجي الحين");
  else if (s.access === "call before coming") bits.push("والفني بيتصل عليك قبل ما يجي");
  else if (s.access) bits.push(`والفني يجي ${AR_ACCESS[s.access] ?? s.access}`);
  const cost = ctx.inDlp && isAcCat(s) ? " وحدتك لسّا ضمن فترة ضمان المقاول، فما عليك أي تكلفة." : "";
  return `خليني أتأكد: ${bits.join("، ")}.${cost} أرسل لك الفني؟`;
}

function nextQuestion(s: VoiceSlots, lang: Lang, ctx: VoiceContext, who?: string): { say: string; asked: VoiceSlots["asked"]; stage: VoiceTurnResult["stage"] } {
  const ar = lang === "ar";
  const isAc = isAcCat(s);
  if (!s.category) return { asked: "category", stage: "gathering", say: ar ? "وش المشكلة اللي عندك؟" : "What's going on at the flat?" };
  if (isAc && !s.symptom) return { asked: "symptom", stage: "gathering", say: ar ? "هل المكيف ما يبرد أبدًا، أو يطلع هواء حار؟ وفي أي غرفة؟" : "Is it not cooling at all, or blowing warm air? And which room is it?" };
  if (!s.room) return { asked: "room", stage: "gathering", say: ar ? "وفي أي غرفة؟" : "Which room is it in?" };
  if (!s.since) return { asked: "since", stage: "gathering", say: ar ? "من متى بدأت المشكلة؟" : "When did it start?" };
  if (s.vulnerableOccupant === undefined) return { asked: "vulnerable", stage: "gathering", say: isAc
    ? (ar ? "هل فيه أحد بالبيت يتعب من الحر، مثل طفل صغير أو كبير في السن أو أحد مريض؟" : "Is there anyone at home who'd really struggle with the heat? A baby, someone elderly, or anyone unwell?")
    : (ar ? "هل فيه ماء قريب من الفيش أو أي شي كهربائي؟" : "Is there any water near sockets or anything electrical?") };
  if (!s.access) return { asked: "access", stage: "gathering", say: ar ? "متى يناسبك يجي الفني؟ الحين، أو تفضلين يتصل عليك قبل؟" : "When's good for the technician to come in? Now, or would you like them to call first?" };
  return { asked: "confirm", stage: "confirming", say: ar ? readBackAr(s, ctx, who) : readBackEn(s, ctx, who) };
}

/** A short, human acknowledgement of what the caller just told us (never a form-style echo). */
function acknowledge(prev: VoiceSlots, next: VoiceSlots, lastCaller: string, lang: Lang, interrupted: boolean): string {
  const ar = lang === "ar";
  const parts: string[] = [];
  if (!prev.category && next.category) {
    parts.push(isAcCat(next) ? (ar ? "آسفة، وفي هذا الحر كمان." : "Oh no, not in this heat.") : ar ? "ولا يهمك، خلينا نحلها." : "Okay, let's get that sorted.");
  } else {
    const heard: string[] = [];
    if (!prev.room && next.room) heard.push(ar ? arRoom(next.room) : `the ${next.room}`);
    if (next.symptom && prev.symptom !== next.symptom) heard.push(ar ? AR_SYM_SPOKEN[next.symptom] ?? next.symptom : EN_SYM_SHORT[next.symptom] ?? next.symptom);
    if (!prev.since && next.since) heard.push(ar ? AR_SINCE_SPOKEN[next.since] ?? next.since : enSince(next.since));
    if (heard.length) parts.push(ar ? `${interrupted ? "تمام، فهمت. " : "تمام، "}${heard.join("، ")}.` : `${interrupted ? "Ah, okay. " : ""}${cap(heard.join(", "))}. Got it.`);
    else if (interrupted) parts.push(ar ? "تمام، فهمت." : "Ah, okay.");
  }
  if (prev.vulnerableOccupant === undefined && next.vulnerableOccupant === true) {
    const who = vulnerableWho(lastCaller, ar);
    parts.push(ar ? `تمام، راح أبلغهم إن عندك ${who} بالبيت عشان يستعجلون.` : `Okay, I'll make sure they know there's ${who} at home, so they treat it as urgent.`);
  }
  if (prev.vulnerableOccupant === undefined && next.vulnerableOccupant === false) parts.push(ar ? "زين." : "Good.");
  if (!prev.access && next.access) parts.push(ar ? "ممتاز." : "Perfect.");
  return parts.length ? parts.join(" ") + " " : "";
}

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((res, rej) => {
  const onAbort = () => { clearTimeout(id); rej(new DOMException("aborted", "AbortError")); };
  const id = setTimeout(() => { signal.removeEventListener("abort", onAbort); res(); }, ms);
  signal.addEventListener("abort", onAbort, { once: true });
});

async function stream(text: string, onText: (d: string) => void, signal: AbortSignal) {
  await sleep(320, signal); // "thinking" latency, feels natural
  for (const w of text.split(/(\s+)/)) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    onText(w);
    if (w.trim()) await sleep(16, signal);
  }
}

export function createDemoBrain(): VoiceBrain {
  return {
    id: "demo",
    greet(ctx) {
      const first = ctx.residentName.split(" ")[0];
      return ctx.lang === "ar"
        ? `أهلًا ${first}، معك خط الصيانة. كيف أقدر أساعدك اليوم؟`
        : `Hi ${first}, you're through to maintenance. What can I help you with today?`;
    },
    async respond(input: VoiceTurnInput, onText, signal): Promise<VoiceTurnResult> {
      const lastCaller = [...input.history].reverse().find((l) => l.role === "caller")?.text ?? "";
      const lang = langOf(lastCaller, input.lang);
      const ar = lang === "ar";
      const slots = absorb(input.slots, lastCaller);
      const asked = input.slots.asked;
      const interrupted = [...input.history].reverse().find((l) => l.role === "agent")?.interrupted === true;
      const callerLines = input.history.filter((l) => l.role === "caller").map((l) => l.text).join(" ");

      if (asked === "vulnerable" && slots.vulnerableOccupant === undefined && saysNo(lastCaller)) slots.vulnerableOccupant = false;
      if (asked === "vulnerable" && slots.vulnerableOccupant === undefined && saysYes(lastCaller)) slots.vulnerableOccupant = true;
      if (asked === "access" && !slots.access && lastCaller.trim()) slots.access = lastCaller.trim();
      if (asked === "since" && !slots.since && lastCaller.trim()) slots.since = lastCaller.trim();
      if (asked === "room" && !slots.room && lastCaller.trim()) slots.room = lastCaller.trim();
      const who = slots.vulnerableOccupant ? vulnerableWho(callerLines, ar) : undefined;

      let prefix = acknowledge(input.slots, slots, lastCaller, lang, interrupted);
      if (slots.safetyHazard && !input.slots.safetyHazard) {
        prefix = ar ? "من فضلك ابتعدي عنه، وافصلي الكهرباء إذا كان ذلك آمن. راح أسجلها حالة طارئة. " : "Please keep well away from it, and switch off the isolator only if it's safe to. I'm treating this as an emergency. ";
      }

      let result: VoiceTurnResult;
      if (asked === "confirm") {
        const changed = JSON.stringify({ ...slots, asked: undefined }) !== JSON.stringify({ ...input.slots, asked: undefined });
        if (saysYes(lastCaller) && !saysNo(lastCaller) && !changed) {
          result = { say: ar ? "ممتاز، أرسله الحين." : "Great, sending it through now.", slots: { ...slots, asked: undefined, summary: summaryOf(slots, lang, input.context) }, stage: "submit", lang };
        } else if (changed) {
          const q = nextQuestion(slots, lang, input.context, who);
          result = { say: (ar ? "تمام، عدّلتها. " : "No problem, I've changed that. ") + q.say, slots: { ...slots, asked: q.asked }, stage: q.stage, lang };
        } else {
          result = { say: ar ? "ولا يهمك، وش تبين أغيّر؟" : "No problem. What should I change?", slots: { ...slots, asked: "confirm" }, stage: "confirming", lang };
        }
      } else if (!slots.category && lastCaller.trim()) {
        result = { say: ar ? "آسفة، ما فهمت عليك زين. ممكن توصفين المشكلة بطريقة ثانية؟" : "Sorry, I didn't quite catch that. Could you tell me what's wrong in another way?", slots: { ...slots, asked: "category" }, stage: "gathering", lang };
      } else {
        const q = nextQuestion(slots, lang, input.context, who);
        result = { say: prefix + q.say, slots: { ...slots, asked: q.asked }, stage: q.stage, lang };
      }
      await stream(result.say, onText, signal);
      return result;
    }
  };
}
