import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { Bilingual, Lang } from "@/domain/types";
import { en, type Dict } from "./en";
import { ar } from "./ar";
import { getBrand, subscribeBrand } from "@/brand/brand";

const TZ = "Asia/Dubai";

export interface I18n {
  lang: Lang;
  dir: "ltr" | "rtl";
  t: Dict;
  /** Fill {placeholders} in a template string. */
  f: (template: string, params?: Record<string, string | number>) => string;
  /** Pick the current-language side of a bilingual value. */
  b: (v: Bilingual | undefined) => string;
  num: (n: number, digits?: number) => string;
  aed: (n: number) => string;
  date: (v: string | number) => string;
  dateShort: (v: string | number) => string;
  time: (v: string | number) => string;
  dateTime: (v: string | number) => string;
  month: (yyyyMm: string) => string;
  duration: (msec: number) => string;
}

export { genericBrand } from "@/brand/brand";
import { genericBrand } from "@/brand/brand";

/** Wording for the client the demo is being shown to; with no client set, neutral wording. */
function swaps(client: string | undefined): Array<[RegExp, string]> {
  const them = client !== undefined && client.trim() !== "" ? client.trim() : undefined;
  if (them === undefined) return GENERIC;
  const possessive = /s$/i.test(them) ? `${them}'` : `${them}'s`;
  return [
    [/Prepared for Dutco Construction/g, `Prepared for ${them}`],
    [/Dutco's own operations/g, `${possessive} own operations`],
    [/Dutco's Plants & Transport service line/g, `${possessive} plant and transport fleet`],
    [/Client buildings and Dutco's own operations/g, `Client buildings and ${possessive} own operations`],
    [/Dutco Construction/g, them],
    [/Dutco's/g, possessive],
    [/Dutco operations/g, `${them} operations`],
    [/\bDutco\b/g, them],
    // Arabic carries the company's description around the name ("شركة … للإنشاءات"), so the whole phrase is
    // replaced rather than the name alone, which would read "for company X for construction".
    [/أُعدّ لشركة دوتكو للإنشاءات/g, `أُعدّ لـ ${them}`],
    [/دوتكو للإنشاءات/g, them],
    [/عمليات دوتكو الداخلية/g, `العمليات الداخلية لـ ${them}`],
    [/عمليات دوتكو/g, `عمليات ${them}`],
    [/لدى دوتكو/g, `لدى ${them}`],
    [/تتحملها دوتكو/g, `يتحملها ${them}`],
    [/دوتكو/g, them]
  ];
}

const GENERIC: Array<[RegExp, string]> = [
  [/Prepared for Dutco Construction/g, "Demo · fictional data"],
  [/Dutco's own operations/g, "Own operations"],
  [/Dutco's Plants & Transport service line/g, "The contractor's plant and transport fleet"],
  [/Client buildings and Dutco's own operations/g, "Client buildings and own operations"],
  [/Dutco Construction/g, "the contractor"],
  [/Dutco's/g, "the contractor's"],
  [/Dutco own operations/g, "Own operations"],
  [/Dutco operations/g, "Own operations"],
  [/\bDutco\b/g, "Contractor"],
  [/أُعدّ لشركة دوتكو للإنشاءات/g, "عرض توضيحي · بيانات تجريبية"],
  [/دوتكو للإنشاءات/g, "المقاول"],
  [/عمليات دوتكو الداخلية/g, "العمليات الداخلية"],
  [/عمليات دوتكو/g, "العمليات الداخلية"],
  [/دوتكو/g, "المقاول"]
];

/** The dictionary with the contractor's name rewritten. */
function rebrand<T>(value: T, rules: Array<[RegExp, string]>): T {
  if (typeof value === "string") { let out: string = value; for (const [re, to] of rules) out = out.replace(re, to); return out as unknown as T; }
  if (Array.isArray(value)) return value.map((v) => rebrand(v, rules)) as unknown as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = rebrand(v, rules);
    return out as unknown as T;
  }
  return value;
}

function build(lang: Lang): I18n {
  const base = lang === "ar" ? ar : en;
  const client = getBrand().clientName;
  let t = base;
  if (genericBrand()) {
    const neutral = rebrand(base, GENERIC);
    t = { ...neutral, app: { ...neutral.app, preparedFor: lang === "ar" ? "عرض توضيحي · بيانات تجريبية" : "Demo · fictional data" } };
  } else if (client !== undefined && client.trim() !== "") {
    t = rebrand(base, swaps(client));
  }
  // Western digits in Arabic by default (OPEN_QUESTIONS Q7).
  const locale = lang === "ar" ? "ar-AE-u-nu-latn" : "en-GB";
  const nf = new Intl.NumberFormat(locale);
  const d = (opts: Intl.DateTimeFormatOptions) => {
    const fmt = new Intl.DateTimeFormat(locale, { timeZone: TZ, ...opts });
    return (v: string | number) => fmt.format(typeof v === "number" ? new Date(v) : new Date(v));
  };
  const f = (template: string, params: Record<string, string | number> = {}) =>
    template.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
  return {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    t,
    f,
    b: (v) => (v ? v[lang] : ""),
    num: (n, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n),
    aed: (n) => (lang === "ar" ? `${nf.format(Math.round(n))} ${t.units.aed}` : `AED ${nf.format(Math.round(n))}`),
    date: d({ day: "numeric", month: "short", year: "numeric" }),
    dateShort: d({ day: "numeric", month: "short" }),
    time: d({ hour: "2-digit", minute: "2-digit", hour12: false }),
    dateTime: d({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }),
    month: (ym) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: TZ }).format(new Date(`${ym}-15T12:00:00+04:00`)),
    duration: (msec) => {
      const abs = Math.abs(msec);
      const mins = Math.floor(abs / 60000);
      const days = Math.floor(mins / 1440);
      const hours = Math.floor((mins % 1440) / 60);
      const m = mins % 60;
      const u = t.units;
      if (days > 0) return `${days}${u.d} ${hours}${u.h}`;
      if (hours > 0) return `${hours}${u.h} ${String(m).padStart(2, "0")}${u.min}`;
      return `${m}${u.min}`;
    }
  };
}

const Ctx = createContext<I18n>(build("en"));

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const client = useSyncExternalStore(subscribeBrand, () => getBrand().clientName, () => undefined);
  const value = useMemo(() => build(lang), [lang, client]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = value.dir;
  }, [lang, value.dir]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
