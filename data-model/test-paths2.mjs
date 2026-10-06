import { readFileSync } from "node:fs";
import { rows, create, submit, reject, state, fmt, findByTitle } from "./kf-flow.mjs";
const WO = "CAFM_Work_Order_A00", BC = "CAFM_Back_charge_A00";
const t = JSON.parse(readFileSync("kf-live/test-wo.json", "utf8")); const W = (k) => t.find((x) => x.k === k)?.id;
const say = (ok, k, msg) => console.log(`${ok ? "✓" : "✗"} ${k} ${msg}`);
const sites = await rows("CAFM_Site_A00"), subs = await rows("CAFM_Subcontractor_A00"), rcs = await rows("CAFM_Root_Cause_A00");
const QMR = sites.find((s) => s.Site_Code === "QMR"), CB = subs.find((s) => s.Company_Name.startsWith("Coolbreeze")), ACT = rcs.find((r) => r.Root_Cause_Code === "actuator_failed");
// B2 was driven with the broken update call (no dispute saved) → wrong test data → reject, keep for audit
const b2 = await findByTitle(BC, "Work_Order_No", `[TEST] ${W("W7")} disputed`);
let s = await state(BC, b2);
if (s.view === "inprogress") s = await reject(BC, b2, "Test data wrong: dispute answer was not saved (update call bug in test script).");
say(s.view === "rejected", "B2", `bad test item rejected ⇒ ${s.view}`);
// B4 dispute, done properly
const b4 = await create(BC, { Work_Order_No: `[TEST] ${W("W8")} disputed`, Work_Order_Instance: W("W8"), Site: { _id: QMR._id }, Subcontractor: { _id: CB._id }, Parts_AED: 0, Labour_AED: 300 }, "Work_Order_No");
s = await state(BC, b4);
for (let i = 0; i < 2 && (s.view === "draft" || s.step === "Back-charge raised"); i++) s = await submit(BC, b4);
if (s.step === "Subcontractor response") s = await submit(BC, b4, { Subcontractor_Response: "Dispute", Dispute_Reason: "Leak traced to the unit above; resident's own fit-out, not our work." });
say(s.step === "Dispute review" && s.assigned.includes("DLP Manager"), "B4", `Dispute routes to Dispute review ⇒ ${fmt(s)}`);
// W7 full DLP path with parts
const w7 = W("W7");
s = await state(WO, w7);
if (s.step === "Subcontractor dispatch") s = await submit(WO, w7);
if (s.step === "Work in progress") s = await submit(WO, w7, { Root_Cause: { _id: ACT._id }, Labour_AED: 350, Closeout_Note: "Replaced failed valve actuator; supply air 12.8°C.",
  WO_Parts: [{ Part: "2-way valve actuator", Qty: 1, Unit_Cost_AED: 420 }, { Part: "Tray cleaner", Qty: 2, Unit_Cost_AED: 15 }] });
const it = s.item ?? {};
say(it.Parts_AED === 450, "W7", `parts: ${(it.WO_Parts ?? []).map((p) => `${p.Qty}×${p.Unit_Cost_AED}=${p.Line_Total_AED}`).join(", ")} → Parts AED ${it.Parts_AED} · labour ${it.Labour_AED} · now ${fmt(s)}`);
if (s.step === "Verify and close") s = await submit(WO, w7);
say(s.view === "completed", "W7", `closed ⇒ ${s.view}`);
