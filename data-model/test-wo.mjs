// Live Work Order route tests. Each scenario: create (copy fields written the way the Custom UI adapter will),
// submit Request raised → Triage, then check which dispatch step + role the condition picked.
import { writeFileSync } from "node:fs";
import { rows, create, submit, reject, state, fmt } from "./kf-flow.mjs";
const P = "CAFM_Work_Order_A00";
const sites = await rows("CAFM_Site_A00"), cats = await rows("CAFM_Request_Category_A00"), assets = await rows("CAFM_Asset_A00"), rcs = await rows("CAFM_Root_Cause_A00");
const S = (c) => sites.find((x) => x.Site_Code === c), C = (c) => cats.find((x) => x.Category_Code === c), A = (t) => assets.find((x) => x.Asset_Tag === t), R = (c) => rcs.find((x) => x.Root_Cause_Code === c);
function body({ title, site, cat, asset, at, rc, channel = "Resident app" }) {
  const s = S(site), c = C(cat), a = asset ? A(asset) : null, r = rc ? R(rc) : null;
  return {
    Site: { _id: s._id }, Category: { _id: c._id }, ...(a ? { Asset: { _id: a._id } } : {}), ...(r ? { Root_Cause: { _id: r._id } } : {}),
    Request_Title: `[TEST${process.env.RUN_TAG ? " " + process.env.RUN_TAG : ""}] ${title}`, Channel: channel, Reporter_Name: "Test run 22 Sep", First_Contact_At: at,
    Own_Operations: s.Own_Operations ?? false, Base_Priority: c.Base_Priority, Summer_Uplift: c.Summer_Uplift ?? false, Structural: c.Structural ?? false,
    Asset_Tag: a?.Asset_Tag, Batch: a?.Batch, DLP_End_Date: a?.DLP_End_Date ?? s.DLP_End_Date, Warranty_End_Date: a?.Warranty_End_Date, Excluded_From_DLP: r?.Excluded_From_DLP ?? false
  };
}
const AUG = "2026-08-18T10:05:00Z";
const cases = [
  { k: "W2", title: "Lift stuck on floor 12 (warranty route)", site: "JDP", cat: "lift", asset: "LIFT-JDP-P1", at: AUG, want: { step: "Subcontractor dispatch", role: "Subcontractor Supervisor", P: 2, L: 4, D: 1 } },
  { k: "W3", title: "AC not cooling, Jaddaf Point (chargeable)", site: "JDP", cat: "ac_not_cooling", asset: "FCU-0907-01", at: AUG, want: { step: "FM dispatch", role: "FM Manager", P: 2, L: 2, D: 2 } },
  { k: "W4", title: "Site office AC (own operations)", site: "DSO", cat: "ac_not_cooling", asset: "AC-DSO-01", at: AUG, want: { step: "FM dispatch", role: "FM Manager", P: 2, L: 5, D: 2 } },
  { k: "W5", title: "Crack in podium slab (structural)", site: "QMR", cat: "structural_crack", at: AUG, want: { step: "Engineering review", role: "DLP Manager", P: 2, L: 3, D: 3 } },
  { k: "W6", title: "AC damaged by occupant (excluded root cause)", site: "QMR", cat: "ac_not_cooling", asset: "FCU-1402-01", at: AUG, rc: "misuse", want: { step: "FM dispatch", role: "FM Manager", P: 2, L: 2, D: 2 } },
  { k: "W7", title: "AC weak in January (no summer uplift)", site: "QMR", cat: "ac_not_cooling", asset: "FCU-1402-01", at: "2026-01-12T07:00:00Z", want: { step: "Subcontractor dispatch", role: "Subcontractor Supervisor", P: 3, L: 1, D: 1 } },
  { k: "W8", title: "Water leak from ceiling, Qamar (P1 inside DLP)", site: "QMR", cat: "water_leak", at: AUG, channel: "Voice agent", want: { step: "Subcontractor dispatch", role: "Subcontractor Supervisor", P: 1, L: 1, D: 1 } }
];
const results = [];
for (const c of cases) {
  const id = await create(P, body(c), "Request_Title");
  let s = await state(P, id);
  if (s.view === "draft" || s.step === "Request raised") s = await submit(P, id); // Request raised → Triage
  const atTriage = fmt(s);
  if (s.step === "Triage") s = await submit(P, id); // Triage → dispatch (conditional)
  const it = s.item ?? {};
  const ok = s.step === c.want.step && s.assigned.includes(c.want.role) && it.Priority_Code === c.want.P && it.Liability_Code === c.want.L && it.Dispatch_Code === c.want.D;
  console.log(`${ok ? "✓" : "✗"} ${c.k} ${c.title}\n    codes P${it.Priority_Code} L${it.Liability_Code} D${it.Dispatch_Code} resp ${it.Response_Minutes}m · ${atTriage} ⇒ ${fmt(s)}`);
  results.push({ k: c.k, id, ok, step: s.step, assigned: s.assigned, codes: { P: it.Priority_Code, L: it.Liability_Code, D: it.Dispatch_Code } });
}
// W9: a junk / duplicate report → helpdesk REJECTS it at Triage (nothing is deleted)
const j = await create(P, body({ title: "Duplicate of W8 (should be rejected)", site: "QMR", cat: "water_leak", at: AUG }), "Request_Title");
if ((await state(P, j)).view === "draft") await submit(P, j);
const jr = await reject(P, j, "Duplicate of an open request (test W9)");
console.log(`${jr.view === "rejected" || /reject/i.test(jr.status ?? "") ? "✓" : "✗"} W9 duplicate rejected at Triage ⇒ ${fmt(jr)} (${jr.view})`);
results.push({ k: "W9", id: j, ok: jr.view === "rejected" || /reject/i.test(jr.status ?? ""), step: jr.step, status: jr.status });
if (!process.env.RUN_TAG) writeFileSync("kf-live/test-wo.json", JSON.stringify(results, null, 1));
