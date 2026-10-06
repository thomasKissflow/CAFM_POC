// Phase 4 seed: loads the frontend's deterministic demo DB (seed/mock-db.json, from export-mock.ts) into Kissflow.
// Idempotent: every record is matched on a natural key and only missing ones are created. Nothing is updated or deleted.
// usage: node seed/seed.mjs [masters|registers|boards|all]
import { readFileSync, writeFileSync } from "node:fs";
import { kf } from "../kf-call.mjs";
const Q = "?_application_id=CAFM_POC_A00";
const { db, ref } = JSON.parse(readFileSync(new URL("./mock-db.json", import.meta.url), "utf8"));
const en = ref.en;
const what = process.argv[2] ?? "all";
import { applyMinimal } from "./minimal.mjs";
if (process.argv.includes("--minimal")) applyMinimal(db);

const report = {};

// ---------- helpers ----------
const date = (iso) => (iso ? String(iso).slice(0, 10) : undefined); // values carry +04:00, so the first 10 chars are the GST date
const dt = (iso) => (iso ? new Date(iso).toISOString().replace(".000Z", "Z") : undefined);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));
async function all(form) {
  const out = [];
  for (let page = 1; ; page++) {
    const r = await kf("POST", `/form/2/{acc}/${form}/allitems/list${Q}&page_size=200&page_number=${page}`, {});
    const rows = r.json?.Data ?? [];
    out.push(...rows);
    if (rows.length < 200) break;
  }
  return out;
}
async function upsert(form, key, rows) {
  const have = new Map((await all(form)).map((r) => [String(r[key]), r]));
  const todo = rows.filter((r) => !have.has(String(r[key])));
  let made = 0, failed = 0;
  for (let i = 0; i < todo.length; i += 50) {
    const chunk = todo.slice(i, i + 50).map((r) => ({ ...clean(r), _is_created: true }));
    const w = await kf("POST", `/form/2/{acc}/${form}/batch${Q}`, chunk);
    if (w.status < 300) { made += chunk.length; for (const x of w.json ?? []) if (x?._id) have.set(String(x[key]), x); }
    else { failed += chunk.length; console.log(`  ✗ ${form} batch ${i}: ${w.status} ${JSON.stringify(w.json).slice(0, 220)}`); }
  }
  report[form] = { existing: rows.length - todo.length, created: made, failed };
  console.log(`${failed ? "✗" : "✓"} ${form}: ${rows.length} wanted · ${rows.length - todo.length} already there · ${made} created${failed ? ` · ${failed} FAILED` : ""}`);
  return have;
}

// ---------- value maps (frontend key → Kissflow list item) ----------
const SITE_KIND = { residential_tower: "Residential tower", site_office: "Site office", labour_accommodation: "Labour accommodation", plant_yard: "Plant yard" };
const TRADE = { hvac: "HVAC", lifts: "Lifts", fire: "Fire", electrical: "Electrical", plumbing: "Plumbing", facade: "Facade", finishes: "Finishes" };
const CHANNEL = { resident_app: "Resident app", voice_agent: "Voice agent", qr_public: "QR poster", phone: "Phone call", helpdesk: "Helpdesk", ppm: "PPM schedule", email: "Email", whatsapp: "WhatsApp", bms: "BMS alarm" };
const SYSTEM = { civil_defence_certificate: "Civil Defence certificate", fire_alarm: "Fire alarm", sprinklers: "Sprinklers", fire_pumps: "Fire pumps", emergency_lighting: "Emergency lighting", extinguishers: "Extinguishers", hassantuk: "Hassantuk link", lifts: "Lift inspection", water_tank_cleaning: "Water tank cleaning", lifting_equipment: "Lifting equipment TPI" };
const FREQ = { monthly: "Monthly", quarterly: "Quarterly", semiannual: "Every 6 months", annual: "Annual" };
const EQ_TYPE = { crawler_crane: "Crawler crane", mobile_crane: "Mobile crane", tower_crane: "Tower crane", excavator: "Excavator", wheel_loader: "Wheel loader", tipper: "Tipper", low_bed: "Low-bed trailer", generator: "Generator", compressor: "Compressor", piling_rig: "Piling rig" };
const EQ_STATUS = { working: "Working", idle: "Idle", breakdown: "Breakdown", service: "In service" };
const HASSANTUK = { connected: "Connected", fault: "Fault", na: "Not applicable", not_applicable: "Not applicable" };
const PCODE = { P1: 1, P2: 2, P3: 3, P4: 4 };
const LCODE = { DLP: 1, CHARGEABLE: 2, DECENNIAL_REVIEW: 3, WARRANTY: 4, OWN_OPS: 5 };
const STEP = { assigned: "Dispatch", in_progress: "Work in progress", on_hold: "Work in progress (on hold)", closed: "Closed", resolved: "Verify and close" };
const BASE = { ac_not_cooling: "P3", ac_noise_leak: "P3", water_leak: "P1", electrical: "P2", lift: "P2", plumbing: "P3", fire_life_safety: "P1", civil_finishes: "P4", doors_hardware: "P3", structural_crack: "P2", ppm: "P4" };

// ---------- masters ----------
let SITES, SUBS, CLASSES, UNITS, CATS;
async function masters() {
  SITES = await upsert("CAFM_Site_A00", "Site_Code", db.sites.map((s) => ({
    Site_Code: s.code, Site_Name: s.name.en, Site_Name_AR: s.name.ar, District: s.district?.en, Site_Kind: SITE_KIND[s.kind], Client_Name: s.client?.en,
    Own_Operations: !!s.ownOperations, TOC_Date: date(s.tocDate), DLP_Months: s.dlpMonths, DLP_End_Date: s.tocDate ? date(db.assets.find((a) => a.siteId === s.id && a.dlpEnd)?.dlpEnd) : undefined,
    Decennial_End_Date: date(db.assets.find((a) => a.siteId === s.id && a.decennialEnd)?.decennialEnd), Floors: s.floors, Unit_Count: s.unitCount, Beds: s.beds
  })));
  SUBS = await upsert("CAFM_Subcontractor_A00", "Company_Name", db.subcontractors.map((s) => ({
    Company_Name: s.name, Company_Name_AR: s.nameAr, Trade: TRADE[s.trade], Trade_Licence_No: s.tradeLicenceNo, Trade_Licence_Expiry: date(s.tradeLicenceExpiry),
    Insurance_Expiry: date(s.insuranceExpiry), Civil_Defence_Approved: !!s.civilDefenceApproved, Civil_Defence_Approval_Expiry: date(s.civilDefenceExpiry)
  })));
  CLASSES = await upsert("CAFM_Asset_Class_A00", "Class_Code", Object.entries(ref.ASSET_CLASS_META).map(([code, m]) => ({
    Class_Code: code, Class_Name: m.label.en, Class_Name_AR: m.label.ar, Trade: TRADE[m.trade], Warranty_Months: m.warrantyMonths
  })));
  CATS = await upsert("CAFM_Request_Category_A00", "Category_Code", Object.keys(BASE).map((c) => ({
    Category_Code: c, Category_Name: en.category[c], Trade: TRADE[ref.CATEGORY_TRADE[c]], Base_Priority: BASE[c],
    Summer_Uplift: c === "ac_not_cooling", Structural: c === "structural_crack"
  })));
  await upsert("CAFM_Root_Cause_A00", "Root_Cause_Code", Object.entries(en.rootCause).map(([c, name]) => ({
    Root_Cause_Code: c, Root_Cause_Name: name, Excluded_From_DLP: ref.DLP_EXCLUDED.includes(c)
  })));
  await upsert("CAFM_SLA_Policy_A00", "Priority", [["P1", 30, 240], ["P2", 60, 480], ["P3", 240, 4320], ["P4", 1440, 14400]].map(([p, r, x]) => ({ Priority: p, Response_Minutes: r, Resolve_Minutes: x, At_Risk_Percent: 75 })));
  const siteId = (id) => SITES.get(db.sites.find((s) => s.id === id)?.code)?._id;
  // units are unique per site: key on "SITE-NUMBER" kept in Unit Number? No: Unit Number alone repeats across sites, so match on site+number below.
  const existingUnits = await all("CAFM_Unit_A00");
  const uKey = (siteCode, n) => `${siteCode}|${n}`;
  const haveU = new Map(existingUnits.map((u) => [uKey(db.sites.find((s) => SITES.get(s.code)?._id === u.Site?._id)?.code, u.Unit_Number), u]));
  const todoU = db.units.filter((u) => !haveU.has(uKey(db.sites.find((s) => s.id === u.siteId).code, u.number)));
  let made = 0;
  for (let i = 0; i < todoU.length; i += 50) {
    const chunk = todoU.slice(i, i + 50).map((u) => ({ Unit_Number: u.number, Site: { _id: siteId(u.siteId) }, Floor: u.floor, _is_created: true }));
    const w = await kf("POST", `/form/2/{acc}/CAFM_Unit_A00/batch${Q}`, chunk);
    if (w.status < 300) made += chunk.length; else console.log(`  ✗ units ${w.status} ${JSON.stringify(w.json).slice(0, 200)}`);
  }
  console.log(`✓ CAFM_Unit_A00: ${db.units.length} wanted · ${db.units.length - todoU.length} already there · ${made} created`);
  UNITS = new Map((await all("CAFM_Unit_A00")).map((u) => [uKey(db.sites.find((s) => SITES.get(s.code)?._id === u.Site?._id)?.code, u.Unit_Number), u]));
  // Asset Tag repeats across towers (e.g. FCU-501-01), so assets are matched on the QR code, which includes the site.
  await upsert("CAFM_Asset_A00", "QR_Code", db.assets.map((a) => {
    const site = db.sites.find((s) => s.id === a.siteId), unit = a.unitId ? db.units.find((u) => u.id === a.unitId) : null;
    return {
      Asset_Tag: a.tag, QR_Code: a.qrCode, Site: { _id: siteId(a.siteId) }, Unit: unit ? { _id: UNITS.get(uKey(site.code, unit.number))?._id } : undefined, Floor: a.floor,
      Location: a.location?.en, Location_AR: a.location?.ar, Asset_Class: { _id: CLASSES.get(a.assetClass)?._id }, Make: a.make, Model: a.model, Serial_Number: a.serial,
      Installed_By: a.installedBy ? { _id: SUBS.get(db.subcontractors.find((s) => s.id === a.installedBy)?.name)?._id } : undefined, Batch: a.batch,
      Handover_Date: date(a.handoverDate), DLP_End_Date: date(a.dlpEnd), Warranty_End_Date: date(a.warrantyEnd), Decennial_End_Date: date(a.decennialEnd), Asset_Status: "Operational"
    };
  }).map((r) => (r.Unit && !r.Unit._id ? { ...r, Unit: undefined } : r)));
}

// ---------- registers ----------
async function registers() {
  if (!SITES) { SITES = new Map((await all("CAFM_Site_A00")).map((r) => [r.Site_Code, r])); SUBS = new Map((await all("CAFM_Subcontractor_A00")).map((r) => [r.Company_Name, r])); CLASSES = new Map((await all("CAFM_Asset_Class_A00")).map((r) => [r.Class_Code, r])); }
  const siteRef = (id) => ({ _id: SITES.get(db.sites.find((s) => s.id === id)?.code)?._id });
  const subRef = (id) => (id ? { _id: SUBS.get(db.subcontractors.find((s) => s.id === id)?.name)?._id } : undefined);
  const bcs = new Map(db.backCharges.map((b) => [b.id, b]));
  await upsert("CAFM_WO_Register_A00", "Work_Order_No", db.workOrders.filter((w) => w.status === "closed").map((w) => {
    const a = w.assetId ? db.assets.find((x) => x.id === w.assetId) : null, u = w.unitId ? db.units.find((x) => x.id === w.unitId) : null, bc = w.backChargeId ? bcs.get(w.backChargeId) : null;
    return {
      Work_Order_No: w.ref, Site: siteRef(w.siteId), Unit_Number: u?.number, Asset_Tag: a?.tag, Batch: a?.batch, Category_Name: en.category[w.category], Channel: CHANNEL[w.channel],
      Priority: w.priority, Summer_Uplift: !!w.summerUplift, Liability: w.liability, Priority_Code: PCODE[w.priority], Liability_Code: LCODE[w.liability], Current_Step: STEP[w.status],
      First_Contact_At: dt(w.reportedAt), Response_Due_At: dt(w.responseDueAt), Resolve_Due_At: dt(w.resolveDueAt), Responded_At: dt(w.respondedAt), Resolved_At: dt(w.resolvedAt), Closed_At: dt(w.closedAt),
      Subcontractor: subRef(w.subcontractorId), Root_Cause_Name: w.rootCause ? en.rootCause[w.rootCause] : undefined, Parts_AED: w.partsAed, Labour_AED: w.labourAed,
      Back_charge_Ref: bc?.ref, Back_charge_Status: bc?.status, Recovered_On: date(bc?.recoveredAt)
    };
  }));
  await upsert("CAFM_Compliance_Certificate_A00", "Certificate_No", db.compliance.map((c) => ({
    Site: siteRef(c.siteId), Compliance_System: SYSTEM[c.system], Contractor: subRef(c.contractorId), Certificate_No: c.certificateNo, Issued_On: date(c.issuedAt), Expires_On: date(c.expiresAt),
    Last_Inspection: date(c.lastInspection), Open_Findings: c.openFindings, Hassantuk_Status: HASSANTUK[c.hassantukStatus]
  })));
  await upsert("CAFM_PPM_Schedule_A00", "Schedule_Title", db.ppm.map((p) => ({
    Schedule_Title: `${p.title.en} · ${db.sites.find((s) => s.id === p.siteId)?.code}`, Schedule_Title_AR: p.title.ar, Site: siteRef(p.siteId), Asset_Class: { _id: CLASSES.get(p.assetClass)?._id },
    Frequency: FREQ[p.frequency], Asset_Count: p.assetCount, Contractor: subRef(p.contractorId), Next_Due_Date: date((p.visits ?? []).find((v) => !v.doneAt)?.due), Active: true
  })));
  await upsert("CAFM_Equipment_A00", "Fleet_No", db.equipment.map((e) => ({
    Fleet_No: e.fleetNo, Equipment_Type: EQ_TYPE[e.type], Make: e.make, Model: e.model, Year: e.year, Current_Project: e.projectLabel?.en, Hour_Meter: e.hours,
    Next_Service_Hours: e.nextServiceHours, TPI_Expiry: date(e.tpiExpiry), Equipment_Status: EQ_STATUS[e.status]
  })));
}

// ---------- boards ----------
const SNAG = { open: null, in_progress: "Status_f9bl8q", ready_for_inspection: "Status_1mpphh2", carried_to_dlp: "Status_akywxe", closed: "Status_1cv9tq0" };
async function boards() {
  if (!SITES) { SITES = new Map((await all("CAFM_Site_A00")).map((r) => [r.Site_Code, r])); SUBS = new Map((await all("CAFM_Subcontractor_A00")).map((r) => [r.Company_Name, r])); }
  const list = async (C) => (await kf("GET", `/case/2/{acc}/${C}/list${Q}&page_size=500&page_number=1`)).json?.Data ?? [];
  const units = await all("CAFM_Unit_A00");
  const have = new Set((await list("CAFM_Snag_A00")).map((x) => x.Snag_Location));
  let made = 0, moved = 0, bad = 0;
  for (const s of db.snags) {
    const label = `${s.ref} · ${s.location.en} · ${s.title.en}`; // the board has no title field, so the ref + title ride in Snag Location
    if (have.has(label)) continue;
    const site = db.sites.find((x) => x.id === s.siteId), unit = s.unitId ? db.units.find((u) => u.id === s.unitId) : null;
    const unitRow = unit ? units.find((u) => u.Unit_Number === unit.number && u.Site?._id === SITES.get(site.code)?._id) : null;
    const r = await kf("POST", `/case/2/{acc}/CAFM_Snag_A00${Q}`, clean({ Site: { _id: SITES.get(site.code)?._id }, Unit: unitRow ? { _id: unitRow._id } : undefined, Trade: TRADE[s.trade],
      Subcontractor: s.subcontractorId ? { _id: SUBS.get(db.subcontractors.find((x) => x.id === s.subcontractorId)?.name)?._id } : undefined, Snag_Location: label }));
    if (r.status >= 300) { bad++; if (bad < 4) console.log(`  ✗ snag ${s.ref} ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`); continue; }
    made++;
    const target = SNAG[s.status];
    if (target) { const m = await kf("POST", `/case/2/{acc}/CAFM_Snag_A00/${r.json._id}/${r.json._status_id ?? "Status_un5as0"}/move${Q}`, { _status_id: target }); if (m.status < 300) moved++; else bad++; }
  }
  console.log(`✓ Handover Snags: ${db.snags.length} in demo · ${made} created · ${moved} moved to their status${bad ? ` · ${bad} problems` : ""}`);
  const eq = await all("CAFM_Equipment_A00");
  const haveB = new Set((await list("CAFM_Breakdown_A00")).map((x) => x.Reported_At));
  let mb = 0;
  for (const b of db.breakdowns) {
    const e = db.equipment.find((x) => x.id === b.equipmentId), row = eq.find((x) => x.Fleet_No === e?.fleetNo);
    if (!row || haveB.has(dt(b.reportedAt))) continue;
    const r = await kf("POST", `/case/2/{acc}/CAFM_Breakdown_A00${Q}`, clean({ Equipment: { _id: row._id }, Reported_At: dt(b.reportedAt), Downtime_Hours: b.downtimeHours }));
    if (r.status < 300) { mb++; await kf("POST", `/case/2/{acc}/CAFM_Breakdown_A00/${r.json._id}/${r.json._status_id ?? "Status_1qc60pj"}/move${Q}`, { _status_id: b.open ? "Status_2pvdo5" : "Status_17ei2mj" }); }
    else console.log(`  ✗ breakdown ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  }
  console.log(`✓ Plant Breakdowns: ${db.breakdowns.length} in demo · ${mb} created`);
}

if (what === "masters" || what === "all") await masters();
if (what === "registers" || what === "all") await registers();
if (what === "boards" || what === "all") await boards();
writeFileSync(new URL(`./seed-report-${what}.json`, import.meta.url), JSON.stringify(report, null, 1));
