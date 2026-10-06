// Lightweight bilingual understanding for the demo brain (keyword based, deterministic).
import type { Category, Lang } from "@/domain/types";
import type { VoiceSlots } from "./types";

export const isArabic = (t: string) => /[؀-ۿ]/.test(t);
export const langOf = (t: string, fallback: Lang): Lang => (isArabic(t) ? "ar" : /[a-z]/i.test(t) ? "en" : fallback);

const norm = (t: string) => ` ${t.toLowerCase().replace(/[.,!?؟،]/g, " ").replace(/\s+/g, " ")} `;
const has = (t: string, words: string[]) => words.some((w) => t.includes(w.length <= 3 ? ` ${w} ` : w));

const CATEGORY_WORDS: Array<[Category, string[]]> = [
  ["ac_noise_leak", ["dripping", "drip", "leaking from the ac", "noisy", "noise", "rattl", "يسرب", "يقطر", "صوت"]],
  ["ac_not_cooling", [" ac ", "a/c", "aircon", "air con", "air-con", "cooling", "not cold", "warm air", "hot air", "too hot", "مكيف", "المكيف", "تبريد", "يبرد", "التكييف", "حر", "حار"]],
  ["water_leak", ["leak", "water coming", "ceiling", "flood", "تسرب", "ماء", "مية", "السقف"]],
  ["electrical", ["power", "socket", "trip", "electric", "no light", "lights", "كهرباء", "الكهرباء", "مقبس", "فيش", "انقطاع"]],
  ["lift", ["lift", "elevator", "مصعد", "المصعد", "الأصنصير"]],
  ["plumbing", ["drain", "blocked", "toilet", "flush", "pressure", "sink", "صرف", "انسداد", "مرحاض", "حمام مسدود"]],
  ["fire_life_safety", ["smoke", "fire alarm", "detector", "دخان", "إنذار", "حريق"]],
  ["doors_hardware", ["door", "lock", "hinge", "handle", "باب", "قفل", "مفصلة"]],
  ["civil_finishes", ["tile", "paint", "wall", "crack", "بلاط", "طلاء", "جدار", "شرخ"]]
];

export function detectCategory(text: string): Category | undefined {
  const t = norm(text);
  for (const [c, words] of CATEGORY_WORDS) if (has(t, words)) return c;
  return undefined;
}

const ROOMS: Array<[string, string[]]> = [
  ["living room", ["living", "lounge", "hall", "salon", "الصالة", "صالة", "غرفة المعيشة", "الصالون"]],
  ["bedroom", ["bedroom", "bed room", "master", "kids room", "غرفة النوم", "غرفة نوم", "الغرفة"]],
  ["kitchen", ["kitchen", "المطبخ", "مطبخ"]],
  ["bathroom", ["bathroom", "toilet", "washroom", "الحمام", "حمام"]],
  ["majlis", ["majlis", "المجلس", "مجلس"]],
  ["whole apartment", ["everywhere", "whole", "all rooms", "كل الغرف", "الشقة كلها", "كلها"]]
];

const SINCE: Array<[string, string[]]> = [
  ["this morning", ["this morning", "morning", "الصبح", "الصباح", "صباح"]],
  ["last night", ["last night", "overnight", "البارحة بالليل", "الليل", "امس بالليل", "أمس بالليل"]],
  ["yesterday", ["yesterday", "أمس", "امس", "البارحة"]],
  ["a few hours", ["hour", "ساعات", "ساعة"]],
  ["a few days", ["days", "week", "أيام", "اسبوع", "أسبوع"]],
  ["just now", ["just now", "right now", "minutes", "الحين", "الآن", "توه", "دقايق"]]
];

const SYMPTOMS: Array<[string, string[]]> = [
  ["blowing warm air", ["warm air", "hot air", "not cold", "warm", "هواء حار", "هوا حار", "حار", "دافي"]],
  ["not cooling at all", ["not cooling", "not working", "doesn't cool", "stopped", "لا يبرد", "ما يبرد", "مايبرد", "لا يعمل", "خربان", "واقف"]],
  ["weak cooling", ["weak", "barely", "a bit", "ضعيف", "خفيف"]],
  ["water dripping", ["drip", "dripping", "leak", "يسرب", "يقطر"]],
  ["making noise", ["noise", "noisy", "sound", "صوت", "ازعاج"]]
];

const VULNERABLE = ["baby", "newborn", "infant", "child", "kid", "elderly", "old", "grandmother", "grandfather", "pregnant", "sick", "asthma",
  "طفل", "رضيع", "بيبي", "ولد", "بنت", "كبير في السن", "كبيرة في السن", "جدي", "جدتي", "حامل", "مريض", "ربو"];
const HAZARD = ["spark", "burning", "smoke", "near the socket", "electric", "shock", "شرارة", "دخان", "ريحة حريق", "قريب من الفيش", "كهرباء"];
const YES = ["yes", "yeah", "yep", "sure", "please", "go ahead", "correct", "right", "ok", "okay", "send", "نعم", "ايوه", "أيوه", "اي", "أكيد", "تمام", "صح", "ارسل", "أرسل", "طيب", "يلا"];
const NO = ["no", "nope", "not really", "nobody", "لا", "مافي", "ما في", "لأ", "كلا"];

export function pick(text: string, table: Array<[string, string[]]>): string | undefined {
  const t = norm(text);
  for (const [v, words] of table) if (has(t, words)) return v;
  return undefined;
}

export const findRoom = (t: string) => pick(t, ROOMS);
export const findSince = (t: string) => pick(t, SINCE);
export const findSymptom = (t: string) => pick(t, SYMPTOMS);
export const saysVulnerable = (t: string) => has(norm(t), VULNERABLE);
export const saysHazard = (t: string) => has(norm(t), HAZARD);
export const saysYes = (t: string) => has(norm(t), YES);
export const saysNo = (t: string) => has(norm(t), NO);

export function findAccess(text: string, askedForAccess = true): string | undefined {
  const t = norm(text);
  if (has(t, ["call first", "call me", "ring", "اتصل", "كلمني", "اتصلوا"])) return "call before coming";
  // "at home" / "I'm home" only means access when we actually asked about access ("a baby at home" does not).
  if (askedForAccess && has(t, ["now", "anytime", "any time", "i'm home", "i am home", "at home", "right away", "الحين", "الآن", "أي وقت", "اي وقت", "موجود", "موجودة", "بالبيت", "في البيت"])) return "now — resident at home";
  const m = text.match(/(after|before|at|around|بعد|قبل|الساعة)\s*([0-9٠-٩]{1,2})(?:[:.]([0-9]{2}))?\s*(am|pm|ص|م)?/i);
  if (m) return m[0];
  if (has(t, ["evening", "tonight", "المساء", "بالليل", "العصر"])) return "this evening";
  if (has(t, ["tomorrow", "بكرة", "بكره", "غدا", "غداً"])) return "tomorrow";
  return undefined;
}

/** Merge whatever a caller utterance reveals into the slots (never erases known values). */
export function absorb(slots: VoiceSlots, text: string): VoiceSlots {
  const askedForAccess = slots.asked === "access";
  const next = { ...slots };
  next.category = detectCategory(text) ?? next.category;
  next.room = findRoom(text) ?? next.room;
  // "now" answers the access question, not "since when": only revisit a known start time when asked or correcting.
  if (!next.since || slots.asked === "since" || slots.asked === "confirm") next.since = findSince(text) ?? next.since;
  next.symptom = findSymptom(text) ?? next.symptom;
  if (saysVulnerable(text)) next.vulnerableOccupant = true;
  if (saysHazard(text)) next.safetyHazard = true;
  next.access = findAccess(text, askedForAccess) ?? next.access;
  return next;
}
