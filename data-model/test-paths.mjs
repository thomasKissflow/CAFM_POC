// Full-path tests on the live processes. Nothing is deleted: wrong items are REJECTED.
import { readFileSync, writeFileSync } from "node:fs";
import { rows, create, submit, reject, state, fmt, findByTitle } from "./kf-flow.mjs";
const WO = "CAFM_Work_Order_A00", BC = "CAFM_Back_charge_A00", PTW = "CAFM_Permit_To_Work_A00";
const log = []; const say = (ok, k, msg) => { console.log(`${ok ? "✓" : "✗"} ${k} ${msg}`); log.push({ ok, k, msg }); };
const sites = await rows("CAFM_Site_A00"), subs = await rows("CAFM_Subcontractor_A00"), rcs = await rows("CAFM_Root_Cause_A00");
const QMR = sites.find((s) => s.Site_Code === "QMR"), CB = subs.find((s) => s.Company_Name.startsWith("Coolbreeze")), VL = subs.find((s) => s.Company_Name.startsWith("Verticon"));
const ACT = rcs.find((r) => r.Root_Cause_Code === "actuator_failed");
const t = JSON.parse(readFileSync("kf-live/test-wo.json", "utf8"));
const W = (k) => t.find((x) => x.k === k)?.id;
const W1 = "PkEEkOVZ2cn0";

// ---- WO full DLP path (W1): dispatch → work in progress (parts child table) → verify → closed
let s = await state(WO, W1);
if (s.step === "Subcontractor dispatch") s = await submit(WO, W1);
if (s.step === "Work in progress") s = await submit(WO, W1, { Root_Cause: { _id: ACT._id }, Labour_AED: 350, Closeout_Note: "Replaced failed 2-way valve actuator; supply air 12.8°C after 20 min.",
  WO_Parts: [{ Part: "2-way valve actuator (Belimo)", Qty: 1, Unit_Cost_AED: 420 }, { Part: "Condensate tray cleaner", Qty: 2, Unit_Cost_AED: 15 }] });
const afterWip = s.item ?? {};
const parts = afterWip.WO_Parts ?? [];
say(afterWip.Parts_AED === 450 && parts.some((p) => p.Line_Total_AED === 420), "W1", `parts child table: ${parts.length} rows, line totals ${parts.map((p) => p.Line_Total_AED).join("+")} → Parts AED ${afterWip.Parts_AED} (want 450)`);
if (s.step === "Verify and close") s = await submit(WO, W1);
say(s.status === "Completed" || s.view === "completed", "W1", `DLP job closed ⇒ ${fmt(s)} (${s.view})`);

// ---- WO chargeable path (W3): FM dispatch → work in progress → verify → closed
s = await state(WO, W("W3"));
for (let i = 0; i < 4 && s.view === "inprogress"; i++) s = await submit(WO, W("W3"), s.step === "Work in progress" ? { Labour_AED: 250, Closeout_Note: "Cleaned clogged filter; chargeable to owner." } : undefined);
say(s.view === "completed", "W3", `chargeable job closed ⇒ ${fmt(s)} (${s.view})`);

// ---- WO structural (W5): engineering review → work in progress
s = await state(WO, W("W5"));
if (s.step === "Engineering review") s = await submit(WO, W("W5"));
say(s.step === "Work in progress", "W5", `after engineering review ⇒ ${fmt(s)}`);

// ---- Back-charges
async function bc(title, body) {
  return create(BC, { Work_Order_No: title, Site: { _id: QMR._id }, ...body }, "Work_Order_No");
}
// B1 accepted: raised → subcontractor response (Accept) → [no dispute review] → recovery confirmation → recovered
const b1 = await bc(`[TEST] ${W1} accepted`, { Work_Order_Instance: W1, Subcontractor: { _id: CB._id }, Root_Cause: { _id: ACT._id }, Parts_AED: 450, Labour_AED: 350 });
s = await state(BC, b1);
if (s.view === "draft" || s.step === "Back-charge raised") s = await submit(BC, b1);
say(s.item?.Total_AED === 800, "B1", `Total AED ${s.item?.Total_AED} (want 800)`);
if (s.step === "Back-charge raised") s = await submit(BC, b1);
if (s.step === "Subcontractor response") s = await submit(BC, b1, { Subcontractor_Response: "Accept" });
say(s.step === "Recovery confirmation", "B1", `Accept skips dispute review ⇒ ${fmt(s)}`);
if (s.step === "Recovery confirmation") s = await submit(BC, b1, { Agreed_AED: 800, Recovered_On: "2026-09-22" });
say(s.view === "completed", "B1", `recovered ⇒ ${fmt(s)} (${s.view})`);
// B2 disputed: → Dispute review (DLP Manager)
const b2 = await bc(`[TEST] ${W("W7")} disputed`, { Work_Order_Instance: W("W7"), Subcontractor: { _id: CB._id }, Parts_AED: 0, Labour_AED: 300 });
s = await state(BC, b2);
for (let i = 0; i < 2 && (s.view === "draft" || s.step === "Back-charge raised"); i++) s = await submit(BC, b2);
if (s.step === "Subcontractor response") s = await submit(BC, b2, { Subcontractor_Response: "Dispute", Dispute_Reason: "Thermostat was set to 30°C by the occupant; no defect found." });
say(s.step === "Dispute review" && s.assigned.includes("DLP Manager"), "B2", `Dispute routes to review ⇒ ${fmt(s)}`);
// B3 wrong: warranty job is the manufacturer's, not a back-charge → rejected at raise
const b3 = await bc(`[TEST] ${W("W2")} warranty (wrong, reject)`, { Work_Order_Instance: W("W2"), Subcontractor: { _id: VL._id }, Labour_AED: 200 });
s = await state(BC, b3);
if (s.view === "draft") s = await submit(BC, b3);
if (s.view === "inprogress") s = await reject(BC, b3, "Warranty claim goes to the manufacturer, not a DLP back-charge (test B3).");
say(s.view === "rejected", "B3", `wrong back-charge rejected ⇒ ${fmt(s)} (${s.view})`);

// ---- Permit to work: P1 full, P2 rejected at HSE approval
let p1 = await findByTitle(PTW, "Work_Location", "[TEST] Roof plant room, welding bracket");
s = await state(PTW, p1);
for (let i = 0; i < 6 && (s.view === "draft" || s.view === "inprogress"); i++) {
  const before = s.step;
  s = await submit(PTW, p1, before === "HSE approval" ? { Approval_Note: "Fire watch assigned; extinguisher on site." } : before === "Work active" ? { Gas_Test_Reading: "LEL 0%" } : before === "HSE close-out" ? { Closed_Out_At: "2026-09-23T12:40:00Z" } : undefined);
  console.log(`    PTW ${before} → ${fmt(s)}`);
}
say(s.view === "completed", "P1", `hot work permit closed ⇒ ${fmt(s)} (${s.view})`);
const p2 = await create(PTW, { Permit_Type: "Confined space", Site: { _id: QMR._id }, Work_Location: "[TEST] Basement sump pit (reject: no gas test)", Valid_From: "2026-09-24T05:00:00Z", Valid_To: "2026-09-24T09:00:00Z" }, "Work_Location");
s = await state(PTW, p2);
if (s.view === "draft") s = await submit(PTW, p2);
if (s.step === "HSE approval") s = await reject(PTW, p2, "No gas test reading or standby person (test P2).");
say(s.view === "rejected", "P2", `confined space permit rejected at HSE approval ⇒ ${fmt(s)} (${s.view})`);

// ---- the minimal probe WO from debugging: wrong item → reject at Triage
const probe = await findByTitle(WO, "Request_Title", "[TEST] Probe submit (minimal)");
if (probe) { s = await state(WO, probe); if (s.view === "draft") s = await submit(WO, probe); if (s.view === "inprogress") s = await reject(WO, probe, "Debug probe, not a real request."); say(s.view === "rejected", "W10", `debug probe rejected ⇒ ${s.view}`); }
writeFileSync("kf-live/test-paths.json", JSON.stringify(log, null, 1));
