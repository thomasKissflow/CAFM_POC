// One labelled [TEST] Work Order through the live process: create → submit (raise) → submit (triage) → expect
// "Subcontractor dispatch" for a summer AC fault inside DLP. Reads codes + current step after each move.
import { kf } from "./kf-call.mjs";
const P = "CAFM_Work_Order_A00", q = "?_application_id=CAFM_POC_A00";
const list = async (form) => (await kf("POST", `/form/2/{acc}/${form}/allitems/list${q}&page_size=200&page_number=1`, {})).json.Data;
const site = (await list("CAFM_Site_A00")).find((r) => r.Site_Code === "QMR");
const cat = (await list("CAFM_Request_Category_A00")).find((r) => r.Category_Code === "ac_not_cooling");
const asset = (await list("CAFM_Asset_A00")).find((r) => r.Asset_Tag === "FCU-1402-01");
const body = {
  Site: { _id: site._id }, Category: { _id: cat._id }, Asset: { _id: asset._id },
  Request_Title: "[TEST] AC not cooling (acceptance check, safe to delete)", Description: "Living room FCU blowing warm air since this morning.",
  Channel: "Voice agent", Reporter_Name: "Layla Al Suwaidi (demo)", First_Contact_At: "2026-08-18T10:05:00Z",
  Conversation_Transcript: "CAFM: Hi Layla… / Caller: My AC is not working at all.", Vulnerable_Occupant: true, Access_Window: "now — resident at home",
  // copy fields the Custom UI adapter writes (API create does not autofill)
  Own_Operations: site.Own_Operations ?? false, Base_Priority: cat.Base_Priority, Summer_Uplift: cat.Summer_Uplift, Structural: cat.Structural,
  Asset_Tag: asset.Asset_Tag, DLP_End_Date: asset.DLP_End_Date, Warranty_End_Date: asset.Warranty_End_Date, Batch: asset.Batch
};
const c = await kf("POST", `/process/2/{acc}/${P}${q}`, body);
console.log("create", c.status, c.json?._id, c.json?._activity_instance_id ?? JSON.stringify(c.json).slice(0, 300));
let id = c.json._id, ai = c.json._activity_instance_id;
const show = async (label) => {
  const g = await kf("GET", `/process/2/{acc}/${P}/${id}${q}`);
  const it = g.json; const step = it._current_step ?? it._current_activity ?? it._status ?? it.Status;
  console.log(`${label}: status ${g.status} step=${JSON.stringify(step)} Priority_Code=${it.Priority_Code} Response=${it.Response_Minutes} Liability_Code=${it.Liability_Code} Dispatch_Code=${it.Dispatch_Code}`);
  return it;
};
await show("after create");
for (const label of ["submit raise", "submit triage"]) {
  const s = await kf("POST", `/process/2/{acc}/${P}/${id}/${ai}/submit${q}`, {});
  console.log(label, s.status, JSON.stringify(s.json).slice(0, 240));
  ai = s.json?._activity_instance_id ?? s.json?.ActivityInstanceId ?? ai;
  await new Promise((r) => setTimeout(r, 2000));
  const it = await show(`after ${label}`);
  if (it._activity_instance_id) ai = it._activity_instance_id;
}
