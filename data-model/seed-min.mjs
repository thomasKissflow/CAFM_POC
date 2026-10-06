// Minimal demo masters (same values as the frontend seed) so autofill can be proven before the WO process is published.
// Idempotent: looks up each record by its code field first. DEMO data only.
import { kf } from "./kf-call.mjs";
const q = "?_application_id=CAFM_POC_A00";
async function upsert(form, keyField, row) {
  const list = await kf("POST", `/form/2/{acc}/${form}/allitems/list${q}&page_size=200&page_number=1`, {});
  const hit = (list.json?.Data ?? []).find((r) => r[keyField] === row[keyField]);
  if (hit) { console.log(`= ${form} ${row[keyField]} ${hit._id}`); return hit; }
  const w = await kf("POST", `/form/2/{acc}/${form}/batch${q}`, [{ ...row, _is_created: true }]);
  const made = Array.isArray(w.json) ? w.json[0] : null;
  console.log(`${w.status < 300 ? "+" : "✗"} ${form} ${row[keyField]} ${made?._id ?? JSON.stringify(w.json).slice(0, 300)}`);
  return made;
}
const site = await upsert("CAFM_Site_A00", "Site_Code", { Site_Code: "QMR", Site_Name: "Qamar Residences", Site_Name_AR: "مساكن قمر", District: "Al Jaddaf, Dubai", Site_Kind: "Residential tower", Client_Name: "Qamar Residences Owners Association (demo)", Own_Operations: false, TOC_Date: "2026-03-01", DLP_Months: 12, DLP_End_Date: "2027-02-28", Floors: 32, Unit_Count: 312 });
const sub = await upsert("CAFM_Subcontractor_A00", "Company_Name", { Company_Name: "Coolbreeze MEP (demo)", Company_Name_AR: "كول بريز للأعمال الكهروميكانيكية (تجريبي)", Trade: "HVAC", Trade_Licence_No: "TL-771204", Trade_Licence_Expiry: "2027-04-12", Insurance_Expiry: "2027-01-31", Civil_Defence_Approved: false });
const cls = await upsert("CAFM_Asset_Class_A00", "Class_Code", { Class_Code: "FCU", Class_Name: "Fan coil unit", Class_Name_AR: "وحدة ملف المروحة", Trade: "HVAC", Warranty_Months: 24 });
const cat = await upsert("CAFM_Request_Category_A00", "Category_Code", { Category_Code: "ac_not_cooling", Category_Name: "AC not cooling", Category_Name_AR: "المكيف لا يبرد", Trade: "HVAC", Base_Priority: "P3", Summer_Uplift: true, Structural: false });
if (site && cls) await upsert("CAFM_Asset_A00", "Asset_Tag", { Asset_Tag: "FCU-1402-01", Site: { _id: site._id }, Floor: 14, Location: "Apt 1402 · living room", Location_AR: "شقة 1402 · غرفة المعيشة", Asset_Class: { _id: cls._id }, Make: "Carrier", Model: "42N-FC 06", Installed_By: sub ? { _id: sub._id } : undefined, Batch: "CB-FCU-B07", Handover_Date: "2026-03-01", DLP_End_Date: "2027-02-28", Warranty_End_Date: "2028-03-01", Asset_Status: "Operational" });

// ---- wider test masters (DEMO), used by test-flows.mjs ----
const jdp = await upsert("CAFM_Site_A00", "Site_Code", { Site_Code: "JDP", Site_Name: "Jaddaf Point", Site_Name_AR: "جداف بوينت", District: "Al Jaddaf, Dubai", Site_Kind: "Residential tower", Client_Name: "Jaddaf Point Holdings (demo)", Own_Operations: false, TOC_Date: "2023-05-15", DLP_Months: 12, DLP_End_Date: "2024-05-14", Floors: 20, Unit_Count: 180 });
const dso = await upsert("CAFM_Site_A00", "Site_Code", { Site_Code: "DSO", Site_Name: "Project 4471 site office", Site_Name_AR: "مكتب موقع المشروع 4471", District: "Dubai South", Site_Kind: "Site office", Client_Name: "Dutco Construction: own operations (demo)", Own_Operations: true });
await upsert("CAFM_Subcontractor_A00", "Company_Name", { Company_Name: "Aquaflow Plumbing (demo)", Company_Name_AR: "أكوافلو للسباكة (تجريبي)", Trade: "Plumbing", Trade_Licence_No: "TL-655420", Trade_Licence_Expiry: "2027-01-18", Insurance_Expiry: "2026-10-20", Civil_Defence_Approved: false });
const vl = await upsert("CAFM_Subcontractor_A00", "Company_Name", { Company_Name: "Verticon Lifts (demo)", Company_Name_AR: "فيرتيكون للمصاعد (تجريبي)", Trade: "Lifts", Trade_Licence_No: "TL-640981", Trade_Licence_Expiry: "2027-02-20", Insurance_Expiry: "2026-12-15", Civil_Defence_Approved: false });
const CATS = [
  ["ac_noise_leak", "AC dripping or noisy", "المكيف يسرب أو يصدر صوتًا", "HVAC", "P3", false, false], ["water_leak", "Water leak", "تسرب مياه", "Plumbing", "P1", false, false],
  ["electrical", "Electrical fault", "عطل كهربائي", "Electrical", "P2", false, false], ["lift", "Lift fault", "عطل في المصعد", "Lifts", "P2", false, false],
  ["plumbing", "Plumbing issue", "مشكلة سباكة", "Plumbing", "P3", false, false], ["fire_life_safety", "Fire alarm fault", "عطل في إنذار الحريق", "Fire", "P1", false, false],
  ["civil_finishes", "Finishes defect", "عيب في التشطيبات", "Finishes", "P4", false, false], ["doors_hardware", "Door or lock issue", "مشكلة باب أو قفل", "Finishes", "P3", false, false],
  ["structural_crack", "Crack in structure", "شرخ في الهيكل", "Finishes", "P2", false, true]
];
for (const [code, en, ar, trade, p, summer, structural] of CATS)
  await upsert("CAFM_Request_Category_A00", "Category_Code", { Category_Code: code, Category_Name: en, Category_Name_AR: ar, Trade: trade, Base_Priority: p, Summer_Uplift: summer, Structural: structural });
const lift = await upsert("CAFM_Asset_Class_A00", "Class_Code", { Class_Code: "LIFT", Class_Name: "Passenger lift", Class_Name_AR: "مصعد ركاب", Trade: "Lifts", Warranty_Months: 24 });
const split = await upsert("CAFM_Asset_Class_A00", "Class_Code", { Class_Code: "SPLIT_AC", Class_Name: "Split AC", Class_Name_AR: "مكيف منفصل", Trade: "HVAC", Warranty_Months: 12 });
await upsert("CAFM_Asset_A00", "Asset_Tag", { Asset_Tag: "FCU-0907-01", Site: { _id: jdp._id }, Floor: 9, Location: "Apt 0907 · living room", Asset_Class: { _id: cls._id }, Make: "Carrier", Model: "42N-FC 06", Installed_By: { _id: sub._id }, Handover_Date: "2023-05-15", DLP_End_Date: "2024-05-14", Warranty_End_Date: "2025-05-15", Asset_Status: "Operational" });
// DEMO: extended manufacturer warranty on the lift (outside DLP, inside warranty) to exercise the WARRANTY route
await upsert("CAFM_Asset_A00", "Asset_Tag", { Asset_Tag: "LIFT-JDP-P1", Site: { _id: jdp._id }, Location: "Passenger lift 1", Asset_Class: { _id: lift._id }, Make: "KONE", Model: "MonoSpace 700", Installed_By: { _id: vl._id }, Handover_Date: "2023-05-15", DLP_End_Date: "2024-05-14", Warranty_End_Date: "2027-05-15", Asset_Status: "Operational" });
await upsert("CAFM_Asset_A00", "Asset_Tag", { Asset_Tag: "AC-DSO-01", Site: { _id: dso._id }, Location: "Site office · meeting room", Asset_Class: { _id: split._id }, Make: "Gree", Model: "GWC24 2.0TR", Asset_Status: "Operational" });
await upsert("CAFM_Root_Cause_A00", "Root_Cause_Code", { Root_Cause_Code: "actuator_failed", Root_Cause_Name: "Valve actuator failed", Trade: "HVAC", Excluded_From_DLP: false });
await upsert("CAFM_Root_Cause_A00", "Root_Cause_Code", { Root_Cause_Code: "misuse", Root_Cause_Name: "Misuse or damage by occupant", Trade: "HVAC", Excluded_From_DLP: true });
await upsert("CAFM_Equipment_A00", "Fleet_No", { Fleet_No: "CR-014", Equipment_Type: "Crawler crane", Make: "Liebherr", Model: "Liebherr LR 1300", Year: 2019, Current_Project: "Project 4471", Hour_Meter: 11890, Next_Service_Hours: 12000, TPI_Expiry: "2026-08-11", Equipment_Status: "Idle" });
