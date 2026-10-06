import { describe, expect, it } from "vitest";
import { classifyLiability } from "./liability";
import { dueDates, priorityFor, readSla } from "./sla";
import { addMonthsGst, ms, toGst } from "./time";
import type { Asset, Site } from "./types";

const qamar: Site = {
  id: "S-QMR", code: "QMR", name: { en: "Qamar", ar: "قمر" }, district: { en: "Al Jaddaf", ar: "الجداف" },
  kind: "residential_tower", client: { en: "c", ar: "c" }, ownOperations: false,
  tocDate: "2026-03-01T00:00:00+04:00", dlpMonths: 12
};
const fcu: Asset = {
  id: "A1", tag: "FCU-1402-01", qrCode: "q", siteId: "S-QMR", floor: 14, location: { en: "", ar: "" },
  assetClass: "FCU", trade: "hvac", make: "m", model: "m", serial: "s", installedBy: "SC-CB",
  dlpEnd: "2027-02-28T23:59:59+04:00", status: "operational"
};
const now = "2026-08-18T14:05:00+04:00";

describe("time", () => {
  it("round-trips GST", () => {
    expect(toGst(ms(now))).toBe(now);
  });
  it("adds months in GST", () => {
    expect(addMonthsGst("2026-03-01T00:00:00+04:00", 12)).toBe("2027-03-01T00:00:00+04:00");
  });
});

describe("priority + SLA", () => {
  it("uplifts AC-not-cooling to P2 in summer", () => {
    expect(priorityFor("ac_not_cooling", now)).toEqual({ priority: "P2", summerUplift: true });
  });
  it("keeps AC-not-cooling at P3 in winter", () => {
    expect(priorityFor("ac_not_cooling", "2026-01-10T10:00:00+04:00")).toEqual({ priority: "P3", summerUplift: false });
  });
  it("computes P2 due dates (1h / 8h)", () => {
    expect(dueDates("P2", now)).toEqual({
      responseDueAt: "2026-08-18T15:05:00+04:00",
      resolveDueAt: "2026-08-18T22:05:00+04:00"
    });
  });
  it("reads on-track, at-risk, breached, met, missed", () => {
    const due = "2026-08-18T15:05:00+04:00";
    expect(readSla(now, due, ms("2026-08-18T14:20:00+04:00")).phase).toBe("on_track");
    expect(readSla(now, due, ms("2026-08-18T14:55:00+04:00")).phase).toBe("at_risk");
    expect(readSla(now, due, ms("2026-08-18T15:30:00+04:00")).phase).toBe("breached");
    expect(readSla(now, due, 0, "2026-08-18T14:47:00+04:00").phase).toBe("met");
    expect(readSla(now, due, 0, "2026-08-18T15:47:00+04:00").phase).toBe("missed");
  });
});

describe("liability engine", () => {
  it("flags DLP with days remaining for the story FCU", () => {
    const r = classifyLiability({ site: qamar, asset: fcu, category: "ac_not_cooling", reportedAt: now });
    expect(r.liability).toBe("DLP");
    expect(r.dlpDaysRemaining).toBe(194);
  });
  it("reclassifies to chargeable when the root cause is an exclusion", () => {
    const r = classifyLiability({ site: qamar, asset: fcu, category: "ac_not_cooling", reportedAt: now, rootCause: "filter_clogged" });
    expect(r.liability).toBe("CHARGEABLE");
  });
  it("keeps DLP for a manufacturing-type failure", () => {
    const r = classifyLiability({ site: qamar, asset: fcu, category: "ac_not_cooling", reportedAt: now, rootCause: "actuator_failed" });
    expect(r.liability).toBe("DLP");
  });
  it("is chargeable after DLP ends", () => {
    const r = classifyLiability({ site: qamar, asset: fcu, category: "ac_not_cooling", reportedAt: "2027-03-15T10:00:00+04:00" });
    expect(r.liability).toBe("CHARGEABLE");
  });
  it("routes structural cracks to decennial review for 10 years", () => {
    const oldSite = { ...qamar, tocDate: "2023-05-15T00:00:00+04:00" };
    const r = classifyLiability({ site: oldSite, category: "structural_crack", reportedAt: now });
    expect(r.liability).toBe("DECENNIAL_REVIEW");
  });
  it("treats Dutco's own facilities as internal cost", () => {
    const r = classifyLiability({ site: { ...qamar, ownOperations: true }, category: "ac_not_cooling", reportedAt: now });
    expect(r.liability).toBe("OWN_OPS");
  });
});
