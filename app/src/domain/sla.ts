import type { Category, ISODate, Priority } from "./types";
import { DAY, HOUR, MINUTE, gstParts, ms, toGst } from "./time";

/** Response / resolution targets. DEMO values (PLAN.md §8): typical GCC FM, not Dutco's contract. */
export const SLA_MATRIX: Record<Priority, { respondMs: number; resolveMs: number }> = {
  P1: { respondMs: 30 * MINUTE, resolveMs: 4 * HOUR },
  P2: { respondMs: 1 * HOUR, resolveMs: 8 * HOUR },
  P3: { respondMs: 4 * HOUR, resolveMs: 3 * DAY },
  P4: { respondMs: 1 * DAY, resolveMs: 10 * DAY }
};

const BASE_PRIORITY: Record<Category, Priority> = {
  ac_not_cooling: "P3",
  ac_noise_leak: "P3",
  water_leak: "P1",
  electrical: "P2",
  lift: "P2",
  plumbing: "P3",
  fire_life_safety: "P1",
  civil_finishes: "P4",
  doors_hardware: "P3",
  structural_crack: "P2",
  ppm: "P4"
};

/** Summer rule: Jun–Sep AC-not-cooling complaints are uplifted to P2 (Dubai heat is a safety issue). */
export function isSummer(iso: ISODate): boolean {
  const { month } = gstParts(ms(iso));
  return month >= 6 && month <= 9;
}

export function priorityFor(category: Category, reportedAt: ISODate): { priority: Priority; summerUplift: boolean } {
  const base = BASE_PRIORITY[category];
  if (category === "ac_not_cooling" && isSummer(reportedAt) && base !== "P1" && base !== "P2") {
    return { priority: "P2", summerUplift: true };
  }
  return { priority: base, summerUplift: false };
}

export function dueDates(priority: Priority, reportedAt: ISODate) {
  const start = ms(reportedAt);
  const m = SLA_MATRIX[priority];
  return { responseDueAt: toGst(start + m.respondMs), resolveDueAt: toGst(start + m.resolveMs) };
}

export type SlaPhase = "on_track" | "at_risk" | "breached" | "met" | "missed";

export interface SlaReading {
  phase: SlaPhase;
  /** elapsed / allowed, 0..n (can exceed 1 when breached) */
  fraction: number;
  /** ms left until due; negative when overdue */
  remainingMs: number;
}

/** Reading of one SLA clock. `doneAt` stops the clock. At-risk from 75% of the allowance. */
export function readSla(startIso: ISODate, dueIso: ISODate, nowEpoch: number, doneAt?: ISODate): SlaReading {
  const start = ms(startIso);
  const due = ms(dueIso);
  const end = doneAt ? ms(doneAt) : nowEpoch;
  const allowed = Math.max(due - start, 1);
  const fraction = Math.max(0, (end - start) / allowed);
  const remainingMs = due - end;
  if (doneAt) return { phase: end <= due ? "met" : "missed", fraction, remainingMs };
  if (end > due) return { phase: "breached", fraction, remainingMs };
  if (fraction >= 0.75) return { phase: "at_risk", fraction, remainingMs };
  return { phase: "on_track", fraction, remainingMs };
}
