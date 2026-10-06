import { describe, expect, it } from "vitest";
import { createMockServices } from "./index";
import { isSummer } from "@/domain/sla";

describe("storyline through the mock services", () => {
  it("raise → DLP flag → accept → diagnosis challenge → resolve → close → back-charge", async () => {
    const s = createMockServices();
    const id = (await s.demo.runStoryStep("raise"))!;
    let wo = (await s.workOrders.get(id))!;
    // The summer rule lifts an AC fault to P2 between June and September; outside those months it stays P3.
    // The test follows the rule rather than the calendar, so it is honest in every season.
    const summer = isSummer(wo.reportedAt);
    expect(wo.priority).toBe(summer ? "P2" : "P3");
    expect(wo.summerUplift).toBe(summer);
    expect(wo.liability).toBe("DLP");
    expect(wo.subcontractorId).toBe("SC-CB");
    expect(wo.channel).toBe("resident_app");

    const ctx = (await s.assets.diagnosis("A-QMR-FCU-1402-01"))!;
    expect(ctx.repeatCount).toBe(3);
    expect(ctx.previous.map((p) => p.rootCause)).toEqual(["thermostat_fault", "filter_clogged"]);
    expect(ctx.siblingFailures.length).toBe(2);

    await s.demo.runStoryStep("accept");
    wo = (await s.workOrders.get(id))!;
    expect(wo.technicianId).toBe("P-JOEL");

    const before = (await s.reports.commandCentre()).dlp.recoveredYtdAed;
    await s.demo.runStoryStep("resolve_dlp");
    const alerts = await s.dlp.batchAlerts();
    expect(alerts.find((a) => a.batch === "CB-FCU-B07")?.count).toBe(3);
    await s.demo.runStoryStep("close");
    wo = (await s.workOrders.get(id))!;
    expect(wo.status).toBe("closed");
    const bc = (await s.dlp.backCharge(wo.backChargeId!))!;
    expect(bc.partsAed + bc.labourAed).toBe(2050);
    expect(bc.subcontractorId).toBe("SC-CB");
    expect((await s.reports.commandCentre()).dlp.recoveredYtdAed).toBe(before); // issued, not yet recovered
  });

  it("reclassifies to chargeable when the technician finds a clogged filter", async () => {
    const s = createMockServices();
    const id = (await s.demo.runStoryStep("raise"))!;
    await s.demo.runStoryStep("accept");
    await s.demo.runStoryStep("resolve_chargeable");
    const wo = (await s.workOrders.get(id))!;
    expect(wo.liability).toBe("CHARGEABLE");
    expect(wo.assigneeOrg).toBe("fm");
    expect(wo.events.some((e) => e.type === "reclassified")).toBe(true);
  });

  it("AI preview triages the Arabic story text", async () => {
    const s = createMockServices();
    const r = await s.ai.triage("المكيف لا يبرد أبدًا منذ الصباح، والحرارة داخل الشقة ٢٩ درجة", "ar", { siteId: "S-QMR", unitId: "U-QMR-1402", at: "2026-08-18T14:05:00+04:00" });
    expect(r.category).toBe("ac_not_cooling");
    expect(r.priority).toBe("P2"); // the call above fixes the date in August, so the summer rule applies
    expect(r.liability).toBe("DLP");
    expect(r.translation?.en).toContain("29 degrees");
  });
});
