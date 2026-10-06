// The demo world was written around a fixed moment (DEMO_DESIGN_NOW) so the data is deterministic: the same
// work orders, the same clocks, the same story every run. But a demo has to look like *today*, and a request
// raised during a demo must be stamped now, not weeks ago.
//
// So the whole world is TRANSLATED: every demo date moves forward by the same amount, and the clock is the real
// clock. Nothing about the data changes except where it sits on the calendar — a job "2 hours from breach" stays
// 2 hours from breach. The shift is recomputed on every load, so the demo never goes stale and nothing has to be
// re-seeded. Records created from REAL_CLOCK_FROM onwards already carry real timestamps and are left alone.
import type { ISODate } from "./types";

/** The moment the demo data was written around. Never change this: the generator's figures depend on it. */
export const DEMO_DESIGN_NOW: ISODate = "2026-08-18T14:05:00+04:00";

/** When the app started stamping real time (Phase 7, 23 Sep 2026). Anything stored before this is demo-era. */
export const REAL_CLOCK_FROM = Date.parse("2026-09-23T06:30:00Z");

/** How far the demo world moves to reach today. Fixed for the life of the page so nothing jumps mid-demo. */
export const DEMO_SHIFT_MS: number = Date.now() - Date.parse(DEMO_DESIGN_NOW);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Moves one ISO date or date-time forward, keeping its original shape (date-only stays date-only, offsets kept). */
export function shiftIso(value: string): string {
  if (!ISO_DATE.test(value)) return value;
  const at = Date.parse(value);
  if (Number.isNaN(at)) return value;
  const moved = new Date(at + DEMO_SHIFT_MS);
  if (!value.includes("T")) return moved.toISOString().slice(0, 10);
  const keepsOffset = /[+-]\d{2}:\d{2}$/.exec(value);
  if (keepsOffset === null) return moved.toISOString().replace(/\.\d{3}Z$/, "Z");
  // keep the original offset (Dubai has no daylight saving, so the wall clock reads the same)
  const offsetMs = (keepsOffset[0].startsWith("-") ? -1 : 1) * (Number(keepsOffset[0].slice(1, 3)) * 60 + Number(keepsOffset[0].slice(4, 6))) * 60_000;
  return new Date(moved.getTime() + offsetMs).toISOString().replace(/\.\d{3}Z$/, "Z").replace("Z", keepsOffset[0]);
}

/** Deep copy with every ISO date moved forward. Used on the generated demo data and on rows read from Kissflow. */
export function shiftDemoDates<T>(value: T): T {
  if (typeof value === "string") return shiftIso(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => shiftDemoDates(v)) as unknown as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = shiftDemoDates(v);
    return out as unknown as T;
  }
  return value;
}

/** The earliest ISO date anywhere in a record, which says which world the record describes. */
function earliestDate(value: unknown, best?: number): number | undefined {
  if (typeof value === "string" && ISO_DATE.test(value)) {
    const at = Date.parse(value);
    return Number.isNaN(at) ? best : best === undefined || at < best ? at : best;
  }
  if (Array.isArray(value)) { let b = best; for (const v of value) b = earliestDate(v, b); return b; }
  if (value !== null && typeof value === "object") { let b = best; for (const v of Object.values(value)) b = earliestDate(v, b); return b; }
  return best;
}

/** True when a record belongs to the demo world rather than to something raised for real.
 *  Either it was written while the clock was still frozen, or (for demo data seeded later) its own dates sit
 *  back in the demo world. Such a record has ALL its dates moved, including future ones like a DLP end date. */
export function isDemoEraRow(row: Record<string, unknown>): boolean {
  const createdAt = row._created_at;
  const created = typeof createdAt === "string" ? Date.parse(createdAt) : NaN;
  if (!Number.isNaN(created) && created < REAL_CLOCK_FROM) return true;
  const earliest = earliestDate(row);
  return earliest === undefined || earliest <= Date.parse(DEMO_DESIGN_NOW) + 24 * 60 * 60 * 1000;
}

/** Kissflow rows, with demo-era dates moved to today and anything created since left untouched. */
export function shiftDemoRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((r) => (isDemoEraRow(r) ? shiftDemoDates(r) : r));
}
