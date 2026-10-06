// Clears the demo data so the app can be re-seeded small (Thomas, 23 Sep). Back up first: node backup-all.mjs
//   dataforms + boards : rows deleted
//   processes          : Kissflow refuses deletes for this key, so open items are REJECTED (they leave the app's
//                        views); drafts, already-rejected and [TEST] completed items are ignored by the app.
//   AI Settings        : kept (it holds the voice prompt and the Gemini key)
// usage: node wipe-data.mjs --yes
import { kf as rawKf } from "./kf-call.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The API drops the connection now and then under a long run of deletes; retry rather than lose the pass. */
async function kf(method, path, body) {
  let last;
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await rawKf(method, path, body); }
    catch (e) { last = e; await sleep(2000 * (attempt + 1)); }
  }
  throw last;
}

if (!process.argv.includes("--yes")) { console.error("refusing to run without --yes"); process.exit(1); }
const Q = "?_application_id=CAFM_POC_A00";
const FORMS = ["CAFM_WO_Register_A00", "CAFM_WO_Event_A00", "CAFM_AI_Conversation_A00", "CAFM_Compliance_Certificate_A00", "CAFM_PPM_Schedule_A00",
  "CAFM_Equipment_A00", "CAFM_Asset_A00", "CAFM_Unit_A00", "CAFM_Site_A00", "CAFM_Subcontractor_A00", "CAFM_Asset_Class_A00",
  "CAFM_Request_Category_A00", "CAFM_Root_Cause_A00", "CAFM_SLA_Policy_A00",
  "CAFM_Handover_Pack_A00", "CAFM_Subcontractor_Technicians_A00", "CAFM_Checklist_Template_A00", "CAFM_WO_Checklist_A00", "CAFM_WO_Photos_A00", "CAFM_WO_Parts_A00", "CAFM_Permit_Controls_A00"];
const BOARDS = ["CAFM_Snag_A00", "CAFM_Breakdown_A00"];
const PROCESSES = ["CAFM_Work_Order_A00", "CAFM_Back_charge_A00", "CAFM_Permit_To_Work_A00"];

for (const form of FORMS) {
  let deleted = 0, failed = 0;
  for (;;) {
    const r = await kf("POST", `/form/2/{acc}/${form}/allitems/list${Q}&page_size=200&page_number=1`, {});
    const rows = r.json?.Data ?? [];
    if (rows.length === 0) break;
    let progressed = false;
    for (const row of rows) {
      const d = await kf("DELETE", `/form/2/{acc}/${form}/${row._id}${Q}`);
      if (d.status < 300) { deleted++; progressed = true; } else failed++;
    }
    if (!progressed) break;
  }
  console.log(`${String(deleted).padStart(5)} deleted  ${form}${failed > 0 ? `  (${failed} refused)` : ""}`);
}

for (const board of BOARDS) {
  let deleted = 0, failed = 0;
  for (;;) {
    const r = await kf("GET", `/case/2/{acc}/${board}/list${Q}&page_size=200&page_number=1`);
    const rows = r.json?.Data ?? [];
    if (rows.length === 0) break;
    let progressed = false;
    for (const row of rows) {
      const d = await kf("DELETE", `/case/2/{acc}/${board}/${row._id}${Q}`);
      if (d.status < 300) { deleted++; progressed = true; } else failed++;
    }
    if (!progressed) break;
  }
  console.log(`${String(deleted).padStart(5)} deleted  ${board}${failed > 0 ? `  (${failed} refused)` : ""}`);
}

for (const p of PROCESSES) {
  let rejected = 0, failed = 0;
  const r = await kf("POST", `/process/2/{acc}/${p}/myitems/inprogress?apply_preference=false&page_number=1&page_size=200&_application_id=CAFM_POC_A00`, {});
  for (const row of r.json?.Data ?? []) {
    // reject acts on the step the item is on NOW, which the list's activity instance id does not always give
    const listed = row._activity_instance_id;
    let aiid = listed;
    if (listed !== undefined) {
      const detail = (await kf("GET", `/process/2/{acc}/${p}/${row._id}/${listed}${Q}&_response_type=full`)).json;
      const ctx = Array.isArray(detail?._current_context) ? detail._current_context[0] : undefined;
      if (ctx?._context_activity_instance_id !== undefined) aiid = ctx._context_activity_instance_id;
    }
    const rej = aiid === undefined ? { status: 400 } : await kf("POST", `/process/2/{acc}/${p}/${row._id}/${aiid}/reject${Q}`, { Note: "Demo data cleared 23 Sep; re-seeded small." });
    if (rej.status < 300) rejected++; else failed++;
  }
  console.log(`${String(rejected).padStart(5)} rejected ${p}${failed > 0 ? `  (${failed} could not be rejected)` : ""}`);
}
console.log("\nAI Settings (voice prompt + Gemini key) kept.");
