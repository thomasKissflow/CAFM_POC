import { describe, expect, it } from "vitest";
import { createMockServices } from "./index";
import { dlpEndOf } from "@/domain/liability";
import { addMonthsGst, ms } from "@/domain/time";

const tower = {
  site: {
    code: "mrh", name: { en: "Marsa Heights", ar: "مرسى هايتس" }, district: { en: "Dubai Marina", ar: "دبي مارينا" },
    kind: "residential_tower" as const, client: { en: "Al Naboodah", ar: "النابودة" }, ownOperations: false,
    tocDate: "2026-09-01T00:00:00+04:00", dlpMonths: 12, floors: 3, unitCount: 6
  },
  units: [
    { number: "101", floor: 1 }, { number: "102", floor: 1 },
    { number: "201", floor: 2 }, { number: "202", floor: 2 },
    { number: "301", floor: 3 }, { number: "302", floor: 3 }
  ],
  assets: [
    { tag: "FCU-101-01", assetClass: "FCU" as const, floor: 1, unitNumber: "101", location: { en: "Apartment 101", ar: "شقة 101" }, installedBy: "SC-CB", handoverDate: "2026-09-01T00:00:00+04:00" },
    { tag: "LIFT-01", assetClass: "LIFT" as const, floor: 0, location: { en: "Passenger lift", ar: "مصعد ركاب" }, handoverDate: "2026-09-01T00:00:00+04:00" }
  ]
};

describe("adding a property", () => {
  it("puts the building, its apartments and its assets into the estate", async () => {
    const s = createMockServices();
    const before = (await s.directory.sites()).length;
    const { site, units, assets } = await s.estate.addProperty(tower);

    expect(site.id).toBe("S-MRH");          // the code is the key, always upper case
    expect(site.code).toBe("MRH");
    expect((await s.directory.sites()).length).toBe(before + 1);
    expect((await s.directory.units(site.id)).map((u) => u.number)).toEqual(["101", "102", "201", "202", "301", "302"]);
    expect(units.length).toBe(6);

    // the liability clock the whole app reads comes from the handover date and the agreed months
    // (dlpEndOf reports the last second still covered, so a job raised then is still the contractor's)
    expect(ms(dlpEndOf(site)!)).toBe(ms(addMonthsGst(tower.site.tocDate, 12)) - 1000);

    const fcu = assets.find((a) => a.tag === "FCU-101-01")!;
    expect(fcu.assetClass).toBe("FCU");
    expect(fcu.trade).toBe("hvac");
    expect(fcu.unitId).toBe("U-MRH-101");            // sits in its apartment, so a resident's request finds it
    expect(fcu.qrCode).toBe("TSL:MRH:FCU-101-01");   // what the technician scans
    expect(fcu.installedBy).toBe("SC-CB");
    expect(ms(fcu.dlpEnd!)).toBe(ms(addMonthsGst(tower.site.tocDate, 12)) - 1000);   // the same last-second convention as the site
    expect(ms(fcu.dlpEnd!)).toBe(ms(dlpEndOf(site)!));                                // and the asset never outlives its building's period
    expect(ms(fcu.warrantyEnd!)).toBe(ms(addMonthsGst(tower.site.tocDate, 24)));

    // a lift is a lift: the class decides the trade, not the first class in the list
    const lift = assets.find((a) => a.tag === "LIFT-01")!;
    expect(lift.assetClass).toBe("LIFT");
    expect(lift.trade).toBe("lifts");
    expect(lift.unitId).toBeUndefined();

    expect((await s.assets.list({ siteId: site.id })).length).toBe(2);
  });

  it("starts the handover pack outstanding, bar the register just imported", async () => {
    const s = createMockServices();
    const { site } = await s.estate.addProperty(tower);
    const pack = await s.handover.pack(site.id);
    expect(pack.length).toBe(8);
    expect(pack.filter((p) => p.received).map((p) => p.id)).toEqual(["HP-5"]);
    expect(pack.find((p) => p.id === "HP-5")!.count).toBe(2);
  });

  it("a request raised against the new building is the contractor's to fix", async () => {
    const s = createMockServices();
    const { site, units } = await s.estate.addProperty(tower);
    const wo = await s.workOrders.create({
      siteId: site.id, unitId: units[0].id, assetId: `A-${site.code}-FCU-101-01`, category: "ac_not_cooling",
      title: { en: "AC not cooling", ar: "التكييف لا يبرد" }, description: "warm air", descriptionLang: "en", channel: "helpdesk"
    }, "P-ARJ");
    expect(wo.siteId).toBe("S-MRH");
    expect(wo.liability).toBe("DLP");   // inside the defects period, so Coolbreeze fixes it at their cost
  });

  it("refuses a code the estate already uses", async () => {
    const s = createMockServices();
    await expect(s.estate.addProperty({ ...tower, site: { ...tower.site, code: "QMR" } })).rejects.toThrow(/already/);
  });

  it("removes a building and everything under it", async () => {
    const s = createMockServices();
    const { site } = await s.estate.addProperty(tower);
    await s.estate.removeProperty(site.id);
    expect((await s.directory.sites()).find((x) => x.id === site.id)).toBeUndefined();
    expect((await s.directory.units(site.id)).length).toBe(0);
    expect((await s.assets.list({ siteId: site.id })).length).toBe(0);
  });

  it("keeps a building that has work orders against it", async () => {
    const s = createMockServices();
    const { site, units } = await s.estate.addProperty(tower);
    await s.workOrders.create({
      siteId: site.id, unitId: units[0].id, category: "water_leak", title: { en: "Leak", ar: "تسرب" },
      description: "water under the sink", descriptionLang: "en", channel: "helpdesk"
    }, "P-ARJ");
    await expect(s.estate.removeProperty(site.id)).rejects.toThrow(/work order/);
    expect((await s.directory.sites()).find((x) => x.id === site.id)).toBeDefined();
  });
});
