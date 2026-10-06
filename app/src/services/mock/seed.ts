// Deterministic demo dataset (seeded PRNG) so every demo run tells the same story.
// All records are DEMO data. Figures are internally consistent, not real Dutco data.
import type {
  Asset, AssetClass, Bilingual, Breakdown, Category, ChatMessage, ComplianceItem, ComplianceSystem,
  Equipment, EquipmentType, HandoverPackItem, Permit, PermitType, PpmFrequency, PpmSchedule, Person, RootCause, Site,
  Snag, SnagStatus, Subcontractor, Trade, Unit, Channel
} from "@/domain/types";
import { DAY, HOUR, MINUTE, addMonthsGst, gstParts, ms, shiftDemoDates, toGst } from "@/domain/time";
import { SLA_MATRIX } from "@/domain/sla";
import {
  ASSET_CLASS_META, CATEGORY_DESCRIPTIONS, CATEGORY_TITLES, CATEGORY_TRADE, CATEGORY_WEIGHTS, DEMO_DESIGN_NOW, PEOPLE, RESIDENT_NAMES,
  ROOT_CAUSES_FOR, ROOT_CAUSE_COST, SITES, SUBCONTRACTORS, SUBCON_FOR_TRADE
} from "./reference";
import { acceptWorkOrder, closeWorkOrder, openWorkOrder, resolveWorkOrder, startWorkOrder, type WorkflowDb } from "./workflow";

export interface Db extends WorkflowDb {
  units: Unit[];
  people: Person[];
  snags: Snag[];
  handoverPack: Record<string, HandoverPackItem[]>;
  compliance: ComplianceItem[];
  ppm: PpmSchedule[];
  permits: Permit[];
  equipment: Equipment[];
  breakdowns: Breakdown[];
  chat: ChatMessage[];
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** The demo world as designed, dated around DEMO_DESIGN_NOW. Seeding Kissflow uses this: the app moves the dates
 *  to today when it loads, so seeded data never goes stale (domain/demoTime.ts). */
export function buildSeedAsDesigned(): Db {
  const rnd = mulberry32(260818);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const weighted = <T,>(pairs: Array<[T, number]>): T => {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let r = rnd() * total;
    for (const [v, w] of pairs) {
      r -= w;
      if (r <= 0) return v;
    }
    return pairs[pairs.length - 1][0];
  };

  const sites: Site[] = SITES.map((s) => ({ ...s }));
  const people: Person[] = PEOPLE.map((p) => ({ ...p }));
  const subcontractors: Subcontractor[] = SUBCONTRACTORS.map((s) => ({ ...s }));
  const units: Unit[] = [];
  const assets: Asset[] = [];

  // ---- units -------------------------------------------------------------------------------
  const towerFloors: Record<string, [number, number]> = { "S-QMR": [5, 30], "S-JDP": [3, 17] };
  for (const [siteId, [f0, f1]] of Object.entries(towerFloors)) {
    for (let f = f0; f <= f1; f++) {
      for (let u = 1; u <= 12; u++) {
        const number = `${f}${pad(u)}`;
        units.push({ id: `U-${siteId.slice(2)}-${number}`, siteId, floor: f, number });
      }
    }
  }
  units.find((u) => u.id === "U-QMR-1402")!.residentId = "P-LAYLA";

  // ---- assets ------------------------------------------------------------------------------
  const siteDates = (site: Site) => {
    if (!site.tocDate) return {};
    return {
      handoverDate: site.tocDate,
      dlpEnd: toGst(ms(addMonthsGst(site.tocDate, site.dlpMonths ?? 12)) - 1000),
      decennialEnd: addMonthsGst(site.tocDate, 120)
    };
  };
  const addAsset = (site: Site, cls: AssetClass, tag: string, floor: number, location: Bilingual, extra: Partial<Asset> = {}) => {
    const meta = ASSET_CLASS_META[cls];
    const dates = siteDates(site);
    assets.push({
      id: `A-${site.code}-${tag}`,
      tag,
      qrCode: `TSL:${site.code}:${tag}`,
      siteId: site.id,
      floor,
      location,
      assetClass: cls,
      trade: meta.trade,
      make: meta.make,
      model: meta.model,
      serial: `${meta.make.slice(0, 2).toUpperCase()}${Math.floor(100000 + rnd() * 899999)}`,
      installedBy: SUBCON_FOR_TRADE[meta.trade],
      ...dates,
      warrantyEnd: site.tocDate ? addMonthsGst(site.tocDate, meta.warrantyMonths) : undefined,
      status: "operational",
      ...extra
    });
  };

  for (const site of sites.filter((s) => s.kind === "residential_tower")) {
    for (const u of units.filter((x) => x.siteId === site.id)) {
      const batch = `CB-FCU-B${pad(Math.floor((u.floor - 12) / 5) + 7)}`;
      addAsset(site, "FCU", `FCU-${u.number}-01`, u.floor, { en: `Apt ${u.number} · living room`, ar: `شقة ${u.number} · غرفة المعيشة` }, { unitId: u.id, batch });
    }
    const plant: Array<[AssetClass, string, number, Bilingual]> = [
      ["ETS", "ETS-01", -1, { en: "B1 · district cooling ETS room", ar: "القبو B1 · غرفة محطة التبريد" }],
      ...[1, 2, 3, 4].map((i): [AssetClass, string, number, Bilingual] => ["CHW_PUMP", `CHWP-0${i}`, -1, { en: "B1 · CHW pump room", ar: "القبو B1 · غرفة مضخات المياه المبردة" }]),
      ...["A", "B", "C", "D"].map((l): [AssetClass, string, number, Bilingual] => ["LIFT", `LIFT-${l}`, 0, { en: `Core lobby · lift ${l}`, ar: `بهو المصاعد · مصعد ${l}` }]),
      ["FIRE_PUMP", "FP-01", -2, { en: "B2 · fire pump room (electric)", ar: "القبو B2 · غرفة مضخات الحريق (كهربائية)" }],
      ["FIRE_PUMP", "FP-02", -2, { en: "B2 · fire pump room (diesel)", ar: "القبو B2 · غرفة مضخات الحريق (ديزل)" }],
      ["FIRE_PUMP", "FP-03", -2, { en: "B2 · fire pump room (jockey)", ar: "القبو B2 · غرفة مضخات الحريق (موازنة)" }],
      ["FIRE_ALARM_PANEL", "FAP-01", 0, { en: "Ground · fire command centre", ar: "الأرضي · مركز التحكم بالحريق" }],
      ["DG_SET", "DG-01", -1, { en: "B1 · generator room", ar: "القبو B1 · غرفة المولد" }],
      ["WATER_TANK", "WT-01", 33, { en: "Roof · domestic water tank 1", ar: "السطح · خزان المياه 1" }],
      ["WATER_TANK", "WT-02", 33, { en: "Roof · domestic water tank 2", ar: "السطح · خزان المياه 2" }],
      ["BOOSTER_PUMP", "BP-01", -1, { en: "B1 · booster pump room", ar: "القبو B1 · غرفة مضخات التعزيز" }],
      ...[1, 2, 3, 4].map((i): [AssetClass, string, number, Bilingual] => ["LV_PANEL", `LVP-0${i}`, -1, { en: `B1 · LV room panel ${i}`, ar: `القبو B1 · لوحة الجهد المنخفض ${i}` }]),
      ...[1, 2, 3, 4].map((i): [AssetClass, string, number, Bilingual] => ["EMERGENCY_LIGHTING", `EML-0${i}`, 0, { en: `Stair core ${i} · emergency lighting`, ar: `درج ${i} · إنارة الطوارئ` }])
    ];
    const zones = site.id === "S-QMR" ? 10 : 6;
    for (let z = 1; z <= zones; z++) plant.push(["SPRINKLER_ZONE", `SPZ-${pad(z)}`, z * 3, { en: `Floors ${z * 3 - 2}–${z * 3} · sprinkler zone`, ar: `الطوابق ${z * 3 - 2}–${z * 3} · منطقة الرشاشات` }]);
    for (const [cls, tag, floor, loc] of plant) addAsset(site, cls, tag, floor, loc);
  }
  const dso = sites.find((s) => s.id === "S-DSO")!;
  const lac = sites.find((s) => s.id === "S-LAC")!;
  for (let i = 1; i <= 24; i++) addAsset(dso, "SPLIT_AC", `AC-DSO-${pad(i)}`, 0, { en: `Site office cabin ${Math.ceil(i / 2)}`, ar: `كابينة المكتب ${Math.ceil(i / 2)}` });
  addAsset(dso, "DG_SET", "DG-DSO-01", 0, { en: "Site office · generator 1", ar: "مكتب الموقع · المولد 1" });
  addAsset(dso, "DG_SET", "DG-DSO-02", 0, { en: "Site office · generator 2", ar: "مكتب الموقع · المولد 2" });
  addAsset(dso, "WATER_TANK", "WT-DSO-01", 0, { en: "Site office · water tank", ar: "مكتب الموقع · خزان المياه" });
  const blocks = ["A", "B", "C", "D"];
  for (let i = 1; i <= 80; i++) {
    const b = blocks[(i - 1) % 4];
    const room = Math.ceil(i / 4);
    addAsset(lac, "SPLIT_AC", `AC-${b}${pad(room)}`, 0, { en: `Block ${b} · room ${room}`, ar: `المبنى ${b} · غرفة ${room}` });
  }
  addAsset(lac, "DG_SET", "DG-LAC-01", 0, { en: "Camp · generator 1", ar: "السكن · المولد 1" });
  addAsset(lac, "DG_SET", "DG-LAC-02", 0, { en: "Camp · generator 2", ar: "السكن · المولد 2" });
  for (let i = 1; i <= 4; i++) addAsset(lac, "WATER_TANK", `WT-LAC-0${i}`, 0, { en: `Camp · water tank ${i}`, ar: `السكن · خزان المياه ${i}` });
  addAsset(lac, "BOOSTER_PUMP", "BP-LAC-01", 0, { en: "Camp · booster pump", ar: "السكن · مضخة التعزيز" });

  const db: Db = {
    sites, units, people, subcontractors, assets,
    workOrders: [], backCharges: [], snags: [], handoverPack: {}, compliance: [], ppm: [], permits: [],
    equipment: [], breakdowns: [], chat: [],
    seq: { wo: 3800, bc: 0, ev: 0 }
  };

  // ---- history of work orders --------------------------------------------------------------
  const nowMs = ms(DEMO_DESIGN_NOW);
  const storyAssets = new Set(["A-QMR-FCU-1402-01", "A-QMR-FCU-1305-01", "A-QMR-FCU-1511-01"]);
  const techFor = (subId: string | undefined, org: string, trade: Trade): string => {
    if (subId) {
      const techs = people.filter((p) => p.role === "technician" && p.subcontractorId === subId);
      if (techs.length) return pick(techs).id;
    }
    if (org === "dutco") return "P-SANJAY";
    return trade === "hvac" ? pick(["P-FAISAL", "P-MARK"]) : "P-MARK";
  };

  type Hist = { site: Site; category: Category; at: number; asset?: Asset; unit?: Unit; rootCause?: RootCause; story?: boolean; channel?: Channel; reporter?: Bilingual; forceOpen?: boolean };
  const plan: Hist[] = [];

  const siteRates: Record<string, (month: number) => number> = {
    "S-QMR": (m) => (m <= 4 ? 3.0 : m <= 6 ? 2.3 : 2.0),
    "S-JDP": () => 1.6,
    "S-DSO": () => 0.3,
    "S-LAC": () => 0.9
  };
  const acFactor: Record<number, number> = { 2: 0.7, 3: 0.9, 4: 1.1, 5: 1.5, 6: 2.1, 7: 2.8, 8: 3.0 };

  for (const site of sites.filter((s) => siteRates[s.id])) {
    const start = Math.max(ms("2026-02-18T00:00:00+04:00"), site.tocDate ? ms(site.tocDate) : 0);
    for (let day = start; day < nowMs; day += DAY) {
      const { month } = gstParts(day);
      const rate = siteRates[site.id](month);
      const n = Math.floor(rate + rnd() * rate);
      for (let k = 0; k < n; k++) {
        const hour = 7 + Math.floor(rnd() * 15);
        const at = day + hour * HOUR + Math.floor(rnd() * 60) * MINUTE;
        if (at >= nowMs - 10 * MINUTE) continue;
        const weights: Array<[Category, number]> = CATEGORY_WEIGHTS.map(([c, w]) => {
          let ww = w;
          if (c === "ac_not_cooling" || c === "ac_noise_leak") ww *= acFactor[month] ?? 1;
          if (site.ownOperations && (c === "lift" || c === "fire_life_safety" || c === "structural_crack")) ww = 0;
          if (site.id === "S-QMR" && c === "structural_crack") ww = 0;
          return [c, ww];
        });
        const category = weighted(weights);
        plan.push({ site, category, at });
      }
    }
  }

  const pickAsset = (site: Site, category: Category, unit?: Unit): Asset | undefined => {
    const siteAssets = assets.filter((a) => a.siteId === site.id && !storyAssets.has(a.id));
    const by = (cls: AssetClass) => siteAssets.filter((a) => a.assetClass === cls);
    switch (category) {
      case "ac_not_cooling":
      case "ac_noise_leak":
        if (unit) return siteAssets.find((a) => a.unitId === unit.id);
        return pick(by("SPLIT_AC"));
      case "lift":
        return pick(by("LIFT"));
      case "fire_life_safety":
        return pick([...by("FIRE_ALARM_PANEL"), ...by("SPRINKLER_ZONE")]);
      case "electrical":
        return rnd() < 0.3 ? pick(by("LV_PANEL").concat(by("DG_SET"))) : undefined;
      default:
        return undefined;
    }
  };

  // Fixed story history for FCU-1402-01 and its batch siblings (Asset 360 + diagnosis challenge).
  const qmr = sites[0];
  const u1402 = units.find((u) => u.id === "U-QMR-1402")!;
  const aOf = (id: string) => assets.find((a) => a.id === id)!;
  plan.push(
    { site: qmr, category: "ac_not_cooling", at: ms("2026-06-24T19:40:00+04:00"), asset: aOf("A-QMR-FCU-1402-01"), unit: u1402, rootCause: "filter_clogged", story: true, channel: "resident_app", reporter: { en: "Layla Al Suwaidi", ar: "ليلى السويدي" } },
    { site: qmr, category: "ac_not_cooling", at: ms("2026-07-07T13:15:00+04:00"), asset: aOf("A-QMR-FCU-1402-01"), unit: u1402, rootCause: "thermostat_fault", story: true, channel: "phone", reporter: { en: "Layla Al Suwaidi", ar: "ليلى السويدي" } },
    { site: qmr, category: "ac_not_cooling", at: ms("2026-07-29T16:20:00+04:00"), asset: aOf("A-QMR-FCU-1305-01"), unit: units.find((u) => u.id === "U-QMR-1305"), rootCause: "actuator_failed", story: true },
    { site: qmr, category: "ac_not_cooling", at: ms("2026-08-09T11:05:00+04:00"), asset: aOf("A-QMR-FCU-1511-01"), unit: units.find((u) => u.id === "U-QMR-1511"), rootCause: "actuator_failed", story: true }
  );
  plan.sort((a, b) => a.at - b.at);

  const channels: Array<[Channel, number]> = [["resident_app", 46], ["phone", 30], ["qr_public", 12], ["helpdesk", 12]];

  for (const h of plan) {
    const siteUnits = units.filter((u) => u.siteId === h.site.id);
    const unit = h.unit ?? (siteUnits.length && h.category !== "lift" && h.category !== "fire_life_safety" ? pick(siteUnits) : undefined);
    const asset = h.asset ?? pickAsset(h.site, h.category, unit);
    const title = pick(CATEGORY_TITLES[h.category]);
    const reportedAt = toGst(h.at);
    const lang = rnd() < 0.3 ? "ar" : "en";
    const reporter = h.reporter ?? (h.site.ownOperations ? { en: "Camp supervisor", ar: "مشرف السكن" } : pick(RESIDENT_NAMES));
    const wo = openWorkOrder(db, {
      siteId: h.site.id,
      unitId: unit?.id,
      assetId: asset?.id,
      category: h.category,
      title,
      description: (() => { const d = pick(CATEGORY_DESCRIPTIONS[h.category]); return lang === "ar" ? d.ar : d.en; })(),
      descriptionLang: lang,
      channel: h.channel ?? (h.site.ownOperations ? "phone" : weighted(channels)),
      reporterName: reporter.en,
      reportedBy: h.reporter?.en === "Layla Al Suwaidi" ? "P-LAYLA" : undefined,
      reportedAt,
      story: h.story
    });

    // Response & resolution times: most within SLA, a realistic minority late.
    const m = SLA_MATRIX[wo.priority];
    const respondFrac = rnd() < 0.04 ? 1.1 + rnd() * 0.6 : 0.2 + rnd() * 0.6;
    const resolveFrac = rnd() < 0.07 ? 1.05 + rnd() * 0.5 : 0.25 + rnd() * 0.65;
    const backlog = !h.story && ((h.at > nowMs - m.resolveMs * 0.92 && rnd() < 0.8) || (h.at > nowMs - 9 * DAY && h.at < nowMs - m.resolveMs && rnd() < 0.04));
    const respondAt = h.at + m.respondMs * respondFrac;
    const resolveAt = h.at + m.resolveMs * (h.story ? 0.55 : resolveFrac);
    const trade = CATEGORY_TRADE[h.category];
    const supervisor = wo.subcontractorId ? subcontractors.find((s) => s.id === wo.subcontractorId)?.supervisorId ?? "system" : "P-ARJUN";
    const tech = techFor(wo.subcontractorId, wo.assigneeOrg, trade);
    if (wo.liability === "DECENNIAL_REVIEW") {
      // engineering review by the DLP manager; older reviews are concluded and closed
      if (respondAt < nowMs) acceptWorkOrder(db, wo, toGst(respondAt), "P-KHALID");
      if (h.at < nowMs - 5 * DAY) {
        resolveWorkOrder(db, wo, toGst(h.at + 30 * HOUR), "P-KHALID", { rootCause: "workmanship", partsAed: 0, labourAed: 900, note: "Engineer's review: non-structural shrinkage crack; sealed and monitored." });
        closeWorkOrder(db, wo, toGst(h.at + 34 * HOUR), "P-KHALID");
      }
      continue;
    }
    if (respondAt < nowMs) {
      acceptWorkOrder(db, wo, toGst(respondAt), supervisor, h.story && h.asset?.id === "A-QMR-FCU-1402-01" ? pick(["P-RAMESH"]) : tech);
      startWorkOrder(db, wo, toGst(respondAt + 20 * MINUTE + rnd() * 40 * MINUTE), wo.technicianId ?? tech);
      if (backlog && rnd() < 0.3) {
        wo.status = "on_hold";
        wo.events.push({ id: `EV-H-${wo.id}`, at: toGst(respondAt + 2 * HOUR), actor: wo.technicianId ?? tech, type: "comment", text: { en: "On hold: awaiting spare part", ar: "معلّق: بانتظار قطعة غيار" } });
      }
    }
    if (resolveAt < nowMs - 30 * MINUTE && !h.forceOpen && !backlog) {
      let rc = h.rootCause ?? weighted(ROOT_CAUSES_FOR[h.category as Exclude<Category, "ppm">]);
      // Keep the batch-B07 story exact: only the scripted sibling actuator failures in the last 60 days.
      // ...and no competing batch clusters elsewhere in the last 60 days.
      if (!h.story && rc === "actuator_failed" && h.at > nowMs - 60 * DAY) rc = "thermostat_fault";
      const [parts, labour] = ROOT_CAUSE_COST[rc];
      const jitter = () => 0.8 + rnd() * 0.4;
      resolveWorkOrder(db, wo, toGst(resolveAt), wo.technicianId ?? tech, {
        rootCause: rc,
        partsAed: Math.round((parts * jitter()) / 10) * 10,
        labourAed: Math.round((labour * jitter()) / 10) * 10,
        signature: "demo",
        note: storyNote(h, rc)
      });
      const closeAt = Math.min(resolveAt + 2 * HOUR + rnd() * 20 * HOUR, nowMs - 5 * MINUTE);
      closeWorkOrder(db, wo, toGst(closeAt), wo.assigneeOrg === "subcon" ? "P-ARJUN" : "P-ARJUN");
    }
  }

  // One AC job in progress with the HVAC technician the demo signs in as, so "Today's jobs" is never empty
  // and the AC-in-DLP story has a live example. Apt 2407, a different batch from the batch-defect story.
  {
    const acAsset = db.assets.find((a) => a.tag === "FCU-2407-01");
    const acUnit = db.units.find((u) => u.id === "U-QMR-2407");
    if (acAsset !== undefined && acUnit !== undefined) {
      const at = nowMs - 2 * HOUR - 40 * MINUTE;
      const wo = openWorkOrder(db, {
        siteId: "S-QMR", unitId: acUnit.id, assetId: acAsset.id, category: "ac_not_cooling",
        title: { en: "AC not cooling", ar: "المكيف لا يبرد" },
        description: "Living room AC blowing warm air since last night; bedroom is fine.",
        descriptionLang: "en", channel: "resident_app", reporterName: "Grace Lim", reportedAt: toGst(at)
      });
      acceptWorkOrder(db, wo, toGst(at + 26 * MINUTE), "P-RASHID", "P-JOEL");
      startWorkOrder(db, wo, toGst(at + 95 * MINUTE), "P-JOEL");
    }
    // …and one just dispatched, waiting for the subcontractor to accept, so the board has a card to move
    const otherFcu = db.assets.find((a) => a.tag === "FCU-1305-01");
    const otherUnit = db.units.find((u) => u.id === "U-QMR-1305");
    if (otherFcu !== undefined && otherUnit !== undefined) {
      openWorkOrder(db, {
        siteId: "S-QMR", unitId: otherUnit.id, assetId: otherFcu.id, category: "ac_noise_leak",
        title: { en: "AC dripping water", ar: "المكيف يسرب ماء" },
        description: "Water dripping from the AC grille onto the sofa.",
        descriptionLang: "en", channel: "qr_public", reporterName: "Priya Sharma", reportedAt: toGst(nowMs - 38 * MINUTE)
      });
    }
  }

  // Back-charge status aging + calibrate recovered YTD to a realistic figure (~AED 186k).
  for (const bc of db.backCharges) {
    const age = nowMs - ms(bc.issuedAt);
    if (age > 21 * DAY) {
      bc.status = rnd() < 0.93 ? "recovered" : "disputed";
      if (bc.status === "recovered") bc.recoveredAt = toGst(ms(bc.issuedAt) + (10 + rnd() * 18) * DAY);
    } else if (age > 7 * DAY) {
      bc.status = rnd() < 0.7 ? "accepted" : rnd() < 0.5 ? "disputed" : "issued";
    } else bc.status = "issued";
  }
  const recovered = db.backCharges.filter((b) => b.status === "recovered").reduce((s, b) => s + b.partsAed + b.labourAed, 0);
  const scale = recovered > 0 ? 186_400 / recovered : 1;
  for (const bc of db.backCharges) {
    bc.partsAed = Math.round((bc.partsAed * scale) / 10) * 10;
    bc.labourAed = Math.round((bc.labourAed * scale) / 10) * 10;
    const wo = db.workOrders.find((w) => w.id === bc.workOrderId);
    if (wo) {
      wo.partsAed = bc.partsAed;
      wo.labourAed = bc.labourAed;
    }
  }

  // ---- snags (Qamar pre-handover) ------------------------------------------------------------
  const snagTitles: Record<Trade, Bilingual[]> = {
    finishes: [{ en: "Paint touch-up at skirting", ar: "إصلاح الطلاء عند الوزرة" }, { en: "Chipped floor tile", ar: "بلاطة أرضية مكسورة الحافة" }, { en: "Joinery door misaligned", ar: "باب خشبي غير محاذٍ" }],
    hvac: [{ en: "Grille not aligned to ceiling", ar: "فتحة التهوية غير محاذية للسقف" }, { en: "Condensate drain slope", ar: "ميل تصريف التكثيف" }],
    plumbing: [{ en: "Silicone missing at basin", ar: "سيليكون مفقود عند المغسلة" }, { en: "Shower mixer loose", ar: "خلاط الدش غير مثبت" }],
    electrical: [{ en: "Socket faceplate scratched", ar: "غطاء المقبس مخدوش" }, { en: "Light fitting flickers", ar: "وحدة الإنارة تومض" }],
    facade: [{ en: "Window gasket gap", ar: "فجوة في حشوة النافذة" }, { en: "Balcony glass scratch", ar: "خدش في زجاج الشرفة" }],
    fire: [{ en: "Sprinkler escutcheon missing", ar: "غطاء الرشاش مفقود" }],
    lifts: [{ en: "Lift car panel scratch", ar: "خدش في لوحة كابينة المصعد" }]
  };
  const snagStatuses: Array<[SnagStatus, number]> = [["closed", 150], ["carried_to_dlp", 14], ["open", 8], ["in_progress", 7], ["ready_for_inspection", 7]];
  let snagSeq = 0;
  for (const [status, count] of snagStatuses) {
    for (let i = 0; i < count; i++) {
      const trade = weighted<Trade>([["finishes", 40], ["hvac", 12], ["plumbing", 14], ["electrical", 12], ["facade", 10], ["fire", 4], ["lifts", 3]]);
      const unit = pick(units.filter((u) => u.siteId === "S-QMR"));
      snagSeq += 1;
      db.snags.push({
        id: `SN-${pad(snagSeq, 4)}`, ref: `SNG-QMR-${pad(snagSeq, 4)}`, siteId: "S-QMR", unitId: unit.id,
        location: { en: `Apt ${unit.number}`, ar: `شقة ${unit.number}` },
        title: pick(snagTitles[trade]), trade, subcontractorId: SUBCON_FOR_TRADE[trade], status,
        raisedAt: toGst(ms("2026-01-10T09:00:00+04:00") + rnd() * 47 * DAY)
      });
    }
  }
  db.handoverPack["S-QMR"] = [
    { id: "HP-1", label: { en: "As-built drawings", ar: "المخططات النهائية المنفذة" }, received: true, receivedAt: "2026-02-20T10:00:00+04:00", count: 412 },
    { id: "HP-2", label: { en: "O&M manuals", ar: "أدلة التشغيل والصيانة" }, received: true, receivedAt: "2026-02-22T10:00:00+04:00", count: 38 },
    { id: "HP-3", label: { en: "Warranties & guarantees", ar: "الضمانات والكفالات" }, received: true, receivedAt: "2026-02-24T10:00:00+04:00", count: 64 },
    { id: "HP-4", label: { en: "Testing & commissioning certificates", ar: "شهادات الاختبار والتشغيل" }, received: true, receivedAt: "2026-02-25T10:00:00+04:00", count: 122 },
    { id: "HP-5", label: { en: "Asset register import", ar: "استيراد سجل الأصول" }, received: true, receivedAt: "2026-02-27T10:00:00+04:00", count: assets.filter((a) => a.siteId === "S-QMR").length },
    { id: "HP-6", label: { en: "Civil Defence completion certificate", ar: "شهادة إنجاز الدفاع المدني" }, received: true, receivedAt: "2026-02-26T10:00:00+04:00", count: 1 },
    { id: "HP-7", label: { en: "Training records (FM team)", ar: "سجلات تدريب فريق المرافق" }, received: true, receivedAt: "2026-02-28T10:00:00+04:00", count: 9 },
    { id: "HP-8", label: { en: "Spare parts & attic stock", ar: "قطع الغيار والمخزون الاحتياطي" }, received: false, count: 0 }
  ];

  // ---- compliance ----------------------------------------------------------------------------
  const comp = (siteId: string, system: ComplianceSystem, expiresAt: string, extra: Partial<ComplianceItem> = {}): ComplianceItem => ({
    id: `CMP-${siteId.slice(2)}-${system}`, siteId, system,
    contractorId: ["fire_alarm", "sprinklers", "fire_pumps", "extinguishers", "emergency_lighting", "hassantuk"].includes(system) ? "SC-RF" : system === "lifts" ? "SC-VL" : undefined,
    certificateNo: `${system.slice(0, 3).toUpperCase()}-${siteId.slice(2)}-${Math.floor(1000 + rnd() * 8999)}`,
    issuedAt: addMonthsGst(expiresAt, -12), expiresAt,
    lastInspection: toGst(ms(expiresAt) - (120 + rnd() * 150) * DAY),
    evidenceCount: 3 + Math.floor(rnd() * 9), openFindings: 0, ...extra
  });
  db.compliance.push(
    comp("S-QMR", "civil_defence_certificate", "2027-03-01T00:00:00+04:00"),
    comp("S-QMR", "fire_alarm", "2027-02-10T00:00:00+04:00"),
    comp("S-QMR", "sprinklers", "2026-09-08T00:00:00+04:00", { openFindings: 1 }),
    comp("S-QMR", "fire_pumps", "2027-01-20T00:00:00+04:00"),
    comp("S-QMR", "emergency_lighting", "2026-12-05T00:00:00+04:00"),
    comp("S-QMR", "extinguishers", "2027-02-28T00:00:00+04:00"),
    comp("S-QMR", "hassantuk", "2027-02-28T00:00:00+04:00", { hassantukStatus: "connected" }),
    comp("S-QMR", "lifts", "2027-02-15T00:00:00+04:00"),
    comp("S-QMR", "water_tank_cleaning", "2026-11-01T00:00:00+04:00"),
    comp("S-JDP", "civil_defence_certificate", "2026-10-30T00:00:00+04:00"),
    comp("S-JDP", "fire_alarm", "2026-09-10T00:00:00+04:00"),
    comp("S-JDP", "sprinklers", "2026-12-12T00:00:00+04:00"),
    comp("S-JDP", "fire_pumps", "2026-11-18T00:00:00+04:00"),
    comp("S-JDP", "emergency_lighting", "2026-08-02T00:00:00+04:00", { openFindings: 2 }),
    comp("S-JDP", "extinguishers", "2026-12-30T00:00:00+04:00"),
    comp("S-JDP", "hassantuk", "2027-01-15T00:00:00+04:00", { hassantukStatus: "connected" }),
    comp("S-JDP", "lifts", "2026-10-01T00:00:00+04:00"),
    comp("S-JDP", "water_tank_cleaning", "2026-10-15T00:00:00+04:00"),
    comp("S-DSO", "fire_alarm", "2027-01-05T00:00:00+04:00"),
    comp("S-DSO", "extinguishers", "2026-12-01T00:00:00+04:00"),
    comp("S-DSO", "emergency_lighting", "2026-11-11T00:00:00+04:00"),
    comp("S-LAC", "civil_defence_certificate", "2026-12-20T00:00:00+04:00"),
    comp("S-LAC", "fire_alarm", "2026-10-25T00:00:00+04:00"),
    comp("S-LAC", "extinguishers", "2026-09-14T00:00:00+04:00"),
    comp("S-LAC", "water_tank_cleaning", "2026-09-03T00:00:00+04:00", { openFindings: 1 }),
    comp("S-YRD", "lifting_equipment", "2026-08-11T00:00:00+04:00", { openFindings: 1 })
  );

  // ---- PPM -------------------------------------------------------------------------------------
  const freqMonths: Record<PpmFrequency, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
  const ppmDefs: Array<[string, AssetClass, PpmFrequency, Bilingual]> = [
    ["S-QMR", "FCU", "quarterly", { en: "FCU service: filters, coils, condensate", ar: "صيانة وحدات ملف المروحة: فلاتر وملفات وتصريف" }],
    ["S-QMR", "CHW_PUMP", "monthly", { en: "CHW pump inspection & vibration check", ar: "فحص مضخات المياه المبردة والاهتزاز" }],
    ["S-QMR", "LIFT", "monthly", { en: "Lift preventive maintenance", ar: "الصيانة الوقائية للمصاعد" }],
    ["S-QMR", "FIRE_PUMP", "monthly", { en: "Fire pump run test", ar: "اختبار تشغيل مضخات الحريق" }],
    ["S-QMR", "SPRINKLER_ZONE", "quarterly", { en: "Sprinkler zone flow test", ar: "اختبار تدفق مناطق الرشاشات" }],
    ["S-QMR", "FIRE_ALARM_PANEL", "quarterly", { en: "Fire alarm cause-and-effect test", ar: "اختبار السبب والأثر لإنذار الحريق" }],
    ["S-QMR", "EMERGENCY_LIGHTING", "monthly", { en: "Emergency lighting function test", ar: "اختبار وظيفة إنارة الطوارئ" }],
    ["S-QMR", "DG_SET", "monthly", { en: "Generator load test", ar: "اختبار تحميل المولد" }],
    ["S-QMR", "WATER_TANK", "semiannual", { en: "Water tank cleaning & disinfection", ar: "تنظيف وتعقيم خزانات المياه" }],
    ["S-JDP", "FCU", "quarterly", { en: "FCU service: filters, coils, condensate", ar: "صيانة وحدات ملف المروحة: فلاتر وملفات وتصريف" }],
    ["S-JDP", "LIFT", "monthly", { en: "Lift preventive maintenance", ar: "الصيانة الوقائية للمصاعد" }],
    ["S-JDP", "FIRE_PUMP", "monthly", { en: "Fire pump run test", ar: "اختبار تشغيل مضخات الحريق" }],
    ["S-JDP", "EMERGENCY_LIGHTING", "monthly", { en: "Emergency lighting function test", ar: "اختبار وظيفة إنارة الطوارئ" }],
    ["S-LAC", "SPLIT_AC", "monthly", { en: "Split AC filter clean (summer)", ar: "تنظيف فلاتر المكيفات (الصيف)" }],
    ["S-LAC", "DG_SET", "monthly", { en: "Generator load test", ar: "اختبار تحميل المولد" }],
    ["S-LAC", "WATER_TANK", "quarterly", { en: "Water tank cleaning & disinfection", ar: "تنظيف وتعقيم خزانات المياه" }],
    ["S-DSO", "SPLIT_AC", "monthly", { en: "Split AC filter clean", ar: "تنظيف فلاتر المكيفات" }]
  ];
  ppmDefs.forEach(([siteId, cls, freq, title], i) => {
    const site = sites.find((s) => s.id === siteId)!;
    const start = site.tocDate && ms(site.tocDate) > ms("2026-02-01T00:00:00+04:00") ? site.tocDate : "2026-02-01T00:00:00+04:00";
    const visits = [];
    for (let k = 0; ; k++) {
      const due = addMonthsGst(start, (k + 1) * freqMonths[freq]);
      if (ms(due) > ms("2026-12-31T00:00:00+04:00")) break;
      const dueDay = toGst(ms(due) + (5 + (i % 20)) * DAY);
      if (ms(dueDay) < nowMs) {
        const r = rnd();
        visits.push(r < 0.03 ? { due: dueDay, evidence: 0 } : { due: dueDay, doneAt: toGst(ms(dueDay) + (r < 0.08 ? 4 + rnd() * 6 : -rnd() * 3) * DAY), evidence: 2 + Math.floor(rnd() * 6) });
      } else visits.push({ due: dueDay, evidence: 0 });
    }
    db.ppm.push({
      id: `PPM-${pad(i + 1, 3)}`, siteId, assetClass: cls, title, frequency: freq,
      assetCount: assets.filter((a) => a.siteId === siteId && a.assetClass === cls).length,
      contractorId: cls === "LIFT" ? "SC-VL" : ["FIRE_PUMP", "SPRINKLER_ZONE", "FIRE_ALARM_PANEL"].includes(cls) ? "SC-RF" : undefined,
      visits
    });
  });

  // ---- permits -------------------------------------------------------------------------------
  const permitDefs: Array<[PermitType, string, Bilingual, Permit["status"], number]> = [
    ["hot_work", "S-QMR", { en: "B1 CHW pump room · pipe weld repair", ar: "القبو B1 · لحام أنابيب غرفة المضخات" }, "active", -2],
    ["work_at_height", "S-QMR", { en: "Façade access · level 22 gasket", ar: "الواجهة · حشوة الطابق 22" }, "approved", 1],
    ["electrical_isolation", "S-QMR", { en: "LVP-03 breaker replacement", ar: "استبدال قاطع اللوحة LVP-03" }, "requested", 0],
    ["confined_space", "S-QMR", { en: "Roof water tank WT-02 inspection", ar: "فحص خزان المياه WT-02 على السطح" }, "requested", 1],
    ["hot_work", "S-DSO", { en: "Site office · steel canopy fix", ar: "مكتب الموقع · تثبيت مظلة فولاذية" }, "closed", -6],
    ["electrical_isolation", "S-LAC", { en: "Camp DG-LAC-02 changeover", ar: "السكن · تبديل المولد DG-LAC-02" }, "closed", -3],
    ["work_at_height", "S-JDP", { en: "Atrium lighting replacement", ar: "استبدال إنارة البهو" }, "closed", -9],
    ["confined_space", "S-LAC", { en: "Camp septic chamber cleaning", ar: "تنظيف حجرة الصرف في السكن" }, "rejected", -1],
    ["hot_work", "S-JDP", { en: "Roof handrail repair", ar: "إصلاح الدرابزين على السطح" }, "approved", 2],
    ["electrical_isolation", "S-DSO", { en: "Site office DB-2 isolation", ar: "عزل اللوحة DB-2 في مكتب الموقع" }, "active", 0],
    ["work_at_height", "S-QMR", { en: "Lift shaft B · door header", ar: "بئر المصعد B · رأس الباب" }, "closed", -12],
    ["hot_work", "S-QMR", { en: "Basement B2 · sleeve welding", ar: "القبو B2 · لحام الأكمام" }, "closed", -15]
  ];
  const controls: Record<PermitType, Bilingual[]> = {
    hot_work: [{ en: "Fire watch 60 min after", ar: "مراقبة حريق 60 دقيقة بعد العمل" }, { en: "Detectors isolated in zone", ar: "عزل الكواشف في المنطقة" }, { en: "Extinguisher at point of work", ar: "طفاية عند موقع العمل" }],
    work_at_height: [{ en: "Harness & anchor inspected", ar: "فحص الحزام ونقطة التثبيت" }, { en: "Exclusion zone below", ar: "منطقة محظورة أسفل العمل" }],
    electrical_isolation: [{ en: "LOTO applied & verified dead", ar: "تطبيق القفل والوسم والتحقق من الفصل" }, { en: "Authorised person present", ar: "حضور شخص مخول" }],
    confined_space: [{ en: "Gas test O₂ / H₂S / LEL", ar: "اختبار الغازات O₂ / H₂S / LEL" }, { en: "Standby person & rescue plan", ar: "شخص احتياطي وخطة إنقاذ" }]
  };
  permitDefs.forEach(([type, siteId, location, status, dayOffset], i) => {
    const from = nowMs + dayOffset * DAY - 4 * HOUR;
    db.permits.push({
      id: `PTW-${pad(i + 1, 3)}`, ref: `PTW-26-${pad(318 + i, 4)}`, type, siteId, location,
      requesterId: pick(["P-JOEL", "P-RAMESH", "P-SURESH", "P-BILAL", "P-SANJAY"]),
      approverId: status === "requested" ? undefined : "P-IMRAN",
      status, validFrom: toGst(from), validTo: toGst(from + 10 * HOUR), controls: controls[type]
    });
  });

  // ---- plant & fleet (Dutco "Plants & Transport" service line; items are DEMO) -------------------
  const fleetDefs: Array<[EquipmentType, string, string[], number, string]> = [
    ["crawler_crane", "CR", ["Liebherr LR 1300", "Liebherr LR 1160", "Kobelco CKE2500", "Sany SCC1500"], 4, "lift"],
    ["mobile_crane", "MC", ["Tadano ATF 90G", "Liebherr LTM 1100", "Grove GMK5150", "Tadano GR-600EX"], 6, "lift"],
    ["tower_crane", "TC", ["Potain MDT 389", "Liebherr 280 EC-H", "Potain MCT 565"], 3, "lift"],
    ["excavator", "EX", ["CAT 336", "Komatsu PC360", "Volvo EC380", "Hyundai HX380"], 12, ""],
    ["wheel_loader", "WL", ["CAT 966", "Volvo L150H", "Komatsu WA470"], 6, ""],
    ["tipper", "TP", ["Mercedes-Benz Actros 4141", "Volvo FMX 460", "MAN TGS 41.440"], 14, ""],
    ["low_bed", "LB", ["Mercedes-Benz Actros 3351 + low-bed"], 4, ""],
    ["generator", "GN", ["Cummins C500", "Caterpillar XQ425", "Perkins 250 kVA"], 7, ""],
    ["compressor", "CP", ["Atlas Copco XAS 185"], 2, ""],
    ["piling_rig", "PR", ["Bauer BG 28", "Soilmec SR-75"], 2, "lift"]
  ];
  const projects: Bilingual[] = [
    { en: "Project 4471 · Dubai South (demo)", ar: "المشروع 4471 · دبي الجنوب (تجريبي)" },
    { en: "Project 4502 · road package (demo)", ar: "المشروع 4502 · حزمة طرق (تجريبي)" },
    { en: "Project 4388 · marine berth (demo)", ar: "المشروع 4388 · رصيف بحري (تجريبي)" },
    { en: "Yard · Jebel Ali Industrial", ar: "الساحة · جبل علي الصناعية" }
  ];
  let fleetSeq = 0;
  for (const [type, prefix, models, count, lifting] of fleetDefs) {
    for (let i = 0; i < count; i++) {
      fleetSeq += 1;
      const model = models[i % models.length];
      const hours = 2000 + Math.floor(rnd() * 14000);
      const interval = type === "tipper" || type === "low_bed" ? 500 : 250;
      const status = weighted<Equipment["status"]>([["working", 72], ["idle", 16], ["breakdown", 6], ["service", 6]]);
      db.equipment.push({
        id: `EQ-${pad(fleetSeq, 3)}`, fleetNo: `${prefix}-${pad(10 + i + 1, 3)}`, type, make: model.split(" ")[0], model,
        year: 2014 + Math.floor(rnd() * 11), siteId: "S-YRD", projectLabel: status === "idle" ? projects[3] : pick(projects.slice(0, 3)),
        hours, nextServiceHours: (Math.floor(hours / interval) + 1) * interval - (rnd() < 0.15 ? interval + 40 : 0),
        tpiExpiry: lifting ? toGst(nowMs + (-20 + rnd() * 300) * DAY) : undefined, status
      });
    }
  }
  const cr = db.equipment.find((e) => e.fleetNo === "CR-014");
  if (cr) {
    cr.model = "Liebherr LR 1300";
    cr.make = "Liebherr";
    cr.tpiExpiry = "2026-08-11T00:00:00+04:00";
    cr.status = "idle";
    cr.projectLabel = projects[3];
  }
  db.equipment.filter((e) => e.status === "breakdown").forEach((e, i) => {
    db.breakdowns.push({
      id: `BD-${pad(i + 1, 3)}`, equipmentId: e.id, reportedAt: toGst(nowMs - (6 + i * 17) * HOUR),
      description: pick([
        { en: "Hydraulic hose burst on boom", ar: "انفجار خرطوم هيدروليكي في الذراع" },
        { en: "Engine overheating alarm", ar: "إنذار ارتفاع حرارة المحرك" },
        { en: "Turbocharger failure", ar: "عطل في الشاحن التوربيني" },
        { en: "Slew ring noise", ar: "صوت في حلقة الدوران" }
      ]),
      downtimeHours: 6 + i * 17, open: true
    });
  });

  // ---- the "before" chat (illustrative, fictional) ------------------------------------------
  db.chat = [
    { id: "c1", at: "07:12", author: "Mark (FM)", kind: "text", text: "Morning all. 3 jobs from last night pending" },
    { id: "c2", at: "08:40", author: "Arjun (Helpdesk)", kind: "text", text: "1402 AC not working AGAIN 🥵 resident called twice" },
    { id: "c3", at: "08:41", author: "Arjun (Helpdesk)", kind: "text", text: "who is going?" },
    { id: "c4", at: "09:15", author: "Faisal", kind: "text", text: "which tower? qamar or jaddaf point?" },
    { id: "c5", at: "09:52", author: "Arjun (Helpdesk)", kind: "text", text: "qamar. also leak 2207 ceiling, and lift B door again" },
    { id: "c6", at: "10:03", author: "Faisal", kind: "text", text: "send photo pls" },
    { id: "c7", at: "10:31", author: "Resident (fwd)", kind: "photo", text: "IMG_4471.jpg" },
    { id: "c8", at: "11:48", author: "Rashid (Coolbreeze)", kind: "voice", seconds: 47 },
    { id: "c9", at: "12:10", author: "Mark (FM)", kind: "text", text: "is 1402 under warranty? who pays for this one" },
    { id: "c10", at: "13:26", author: "Arjun (Helpdesk)", kind: "text", text: "done?" },
    { id: "c11", at: "16:02", author: "Arjun (Helpdesk)", kind: "text", text: "resident says still hot. escalating to sarah" },
    { id: "c12", at: "23:40", author: "Sarah (FM Mgr)", kind: "text", text: "copying today's chat into the tracker for the monthly report… anyone have times for 2207?" }
  ];

  return db;
}

/** The demo world as the app shows it: the designed world, moved to today. */
export function buildSeed(): Db {
  return shiftDemoDates(buildSeedAsDesigned());
}

function storyNote(h: { story?: boolean; rootCause?: RootCause; asset?: Asset }, rc: RootCause): string | undefined {
  if (!h.story) return undefined;
  if (rc === "filter_clogged") return "Weak cooling: filter cleaned, operation restored.";
  if (rc === "thermostat_fault") return "Thermostat recalibrated; supply air 14°C after 20 min.";
  if (rc === "actuator_failed") return "CHW control valve actuator failed (no stroke); replaced like-for-like.";
  return undefined;
}
