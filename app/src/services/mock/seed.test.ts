import { describe, expect, it } from "vitest";
import { buildSeed } from "./seed";
import { readSla } from "@/domain/sla";
import { ms } from "@/domain/time";
import { DEMO_NOW } from "./reference";

describe("seed", () => {
  const db = buildSeed();
  it("is deterministic", () => {
    const b = buildSeed();
    expect(b.workOrders.length).toBe(db.workOrders.length);
    expect(b.workOrders[10].ref).toBe(db.workOrders[10].ref);
  });
  it("has plausible volumes and story assets", () => {
    const now = ms(DEMO_NOW);
    const open = db.workOrders.filter((w) => w.status !== "closed");
    const aug = db.workOrders.filter((w) => w.reportedAt.startsWith("2026-08") && w.closedAt);
    const met = aug.filter((w) => readSla(w.reportedAt, w.resolveDueAt, now, w.resolvedAt).phase === "met").length;
    const recovered = db.backCharges.filter((b) => b.status === "recovered").reduce((s, b) => s + b.partsAed + b.labourAed, 0);
    const byLia: Record<string, number> = {};
    db.workOrders.forEach((w) => (byLia[w.liability] = (byLia[w.liability] ?? 0) + 1));
    console.log({
      wos: db.workOrders.length, open: open.length, assets: db.assets.length, bcs: db.backCharges.length,
      slaAugPct: Math.round((met / aug.length) * 100), recovered, byLia,
      breachedOpen: open.filter((w) => readSla(w.reportedAt, w.resolveDueAt, now).phase === "breached").length,
      eq: db.equipment.length, ppm: db.ppm.length
    });
    expect(db.workOrders.filter((w) => w.assetId === "A-QMR-FCU-1402-01").length).toBe(2);
    expect(db.workOrders.length).toBeGreaterThan(300);
  });
});
