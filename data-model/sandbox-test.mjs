// Runtime proof of the Work Order formulas on the editable sandbox dataform (Phase 4 step 4).
import { kf } from "./kf-call.mjs";
const APP = "CAFM_POC_A00", F = process.env.SANDBOX_ID ?? "CAFM_zz_Formula_Sandbox_A00", q = `?_application_id=${APP}`;
const cases = [
  { Test_Case: "F1 summer AC inside DLP", First_Contact_At: "2026-08-18T10:05:00Z", DLP_End_Date: "2027-02-28", Warranty_End_Date: "2027-03-01", Base_Priority: "P3", Summer_Uplift: true, C_Qty: 2, C_Unit_Num: 3.5, expect: { Report_Month: 8, Summer_Flag: 1, Priority_Code: 2, Response_Minutes: 60, Resolve_Minutes: 480, DLP_Covered: 1, Liability_Code: 1, Dispatch_Code: 1, E_Days_Signed: 159, C_Num_Line: 7 } },
  { Test_Case: "F2 outside DLP inside warranty", First_Contact_At: "2026-08-18T10:05:00Z", DLP_End_Date: "2026-03-01", Warranty_End_Date: "2027-01-01", Base_Priority: "P3", Summer_Uplift: false, expect: { Priority_Code: 3, DLP_Covered: 0, Warranty_Covered: 1, Liability_Code: 4, Dispatch_Code: 1, E_Days_Signed: -205 } },
  { Test_Case: "F3 outside both", First_Contact_At: "2026-08-18T10:05:00Z", DLP_End_Date: "2026-03-01", Warranty_End_Date: "2026-04-01", Base_Priority: "P2", expect: { Liability_Code: 2, Response_Minutes: 60, Dispatch_Code: 2 } },
  { Test_Case: "F4 blank dates", First_Contact_At: "2026-08-18T10:05:00Z", Base_Priority: "P4", expect: { Liability_Code: 2, Priority_Code: 4, Resolve_Minutes: 14400, DLP_Covered: 0, Warranty_Covered: 0, Dispatch_Code: 2 } },
  { Test_Case: "F5 own operations", First_Contact_At: "2026-08-18T10:05:00Z", DLP_End_Date: "2027-02-28", Own_Operations: true, Base_Priority: "P3", expect: { Liability_Code: 5, Dispatch_Code: 2 } },
  { Test_Case: "F6 structural", First_Contact_At: "2026-08-18T10:05:00Z", DLP_End_Date: "2027-02-28", Structural: true, Base_Priority: "P1", expect: { Liability_Code: 3, Priority_Code: 1, Response_Minutes: 30, Dispatch_Code: 3 } },
  { Test_Case: "F7 winter no uplift", First_Contact_At: "2026-01-10T10:05:00Z", DLP_End_Date: "2027-02-28", Base_Priority: "P3", Summer_Uplift: true, expect: { Report_Month: 1, Summer_Flag: 0, Priority_Code: 3 } },
  { Test_Case: "F8 DLP end day", First_Contact_At: "2027-02-28T08:00:00Z", DLP_End_Date: "2027-02-28", Base_Priority: "P3", expect: { DLP_Covered: 1, Liability_Code: 1 } },
  { Test_Case: "F9 day after DLP", First_Contact_At: "2027-03-01T08:00:00Z", DLP_End_Date: "2027-02-28", Base_Priority: "P3", expect: { DLP_Covered: 0, Liability_Code: 2 } },
  { Test_Case: "F10 excluded root cause", First_Contact_At: "2026-08-18T10:05:00Z", DLP_End_Date: "2027-02-28", Excluded_From_DLP: true, Base_Priority: "P3", expect: { Liability_Code: 2, Dispatch_Code: 2 } }
];
const created = new Set();
const rows = cases.map(({ expect, ...c }) => ({ ...c, _is_created: true }));
if (process.argv[2] !== "--read") {
  const w = await kf("POST", `/form/2/{acc}/${F}/batch${q}`, rows);
  for (const r of Array.isArray(w.json) ? w.json : []) if (r?._id) created.add(r._id);
  console.log("create", w.status, Array.isArray(w.json) ? `${w.json.length} rows` : JSON.stringify(w.json).slice(0, 400));
  await new Promise((r) => setTimeout(r, 2500));
}
const list = await kf("POST", `/form/2/{acc}/${F}/allitems/list${q}&page_size=200&page_number=1`, {});
const items = Array.isArray(list.json) ? list.json : list.json?.Data ?? [];
console.log("read", list.status, items.length, "items");
if (!items.length) console.log(JSON.stringify(list.json).slice(0, 500));
let pass = 0, fail = 0;
for (const c of cases) {
  const it = items.filter((i) => i.Test_Case === c.Test_Case && (created.size === 0 || created.has(i._id))).pop();
  if (!it) { console.log(`? ${c.Test_Case}: not found`); fail++; continue; }
  const diffs = Object.entries(c.expect).filter(([k, v]) => String(it[k]) !== String(v)).map(([k, v]) => `${k}=${JSON.stringify(it[k])} (want ${v})`);
  console.log(`${diffs.length ? "✗" : "✓"} ${c.Test_Case}${diffs.length ? "  → " + diffs.join(", ") : ""}`);
  diffs.length ? fail++ : pass++;
}
console.log(`sandbox: ${pass} pass, ${fail} fail`);
