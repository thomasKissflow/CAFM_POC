import type { ISODate } from "./types";
export { DEMO_DESIGN_NOW, DEMO_SHIFT_MS, shiftDemoDates, shiftDemoRows, shiftIso } from "./demoTime";

// Dubai does not observe DST, so a fixed +04:00 offset is exact for GST.
const GST_OFFSET_MS = 4 * 60 * 60 * 1000;
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function ms(iso: ISODate): number {
  return Date.parse(iso);
}

/** Serialise an epoch to ISO-8601 in Gulf Standard Time (+04:00). */
export function toGst(epoch: number): ISODate {
  const d = new Date(epoch + GST_OFFSET_MS);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+04:00`
  );
}

/** Calendar parts of an instant as seen in Dubai. */
export function gstParts(epoch: number) {
  const d = new Date(epoch + GST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay()
  };
}

/** The last `count` month keys ("2026-04" …) up to and including the month `at` falls in, in Dubai time. */
export function monthKeysEndingAt(at: number, count: number): string[] {
  const p = gstParts(at);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(p.year, p.month - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function addMonthsGst(iso: ISODate, months: number): ISODate {
  const p = gstParts(ms(iso));
  const target = Date.UTC(p.year, p.month - 1 + months, p.day, p.hour, p.minute) - GST_OFFSET_MS;
  return toGst(target);
}

export function daysBetween(fromIso: ISODate, toIso: ISODate): number {
  return Math.floor((ms(toIso) - ms(fromIso)) / DAY);
}
