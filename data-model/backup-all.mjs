// Exports every row of every CAFM flow to data-model/backups/<timestamp>/ before any destructive change.
// usage: node backup-all.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { kf } from "./kf-call.mjs";

const Q = "?_application_id=CAFM_POC_A00";
const FORMS = ["CAFM_Site_A00", "CAFM_Unit_A00", "CAFM_Asset_A00", "CAFM_Asset_Class_A00", "CAFM_Request_Category_A00", "CAFM_Root_Cause_A00",
  "CAFM_Subcontractor_A00", "CAFM_SLA_Policy_A00", "CAFM_PPM_Schedule_A00", "CAFM_Compliance_Certificate_A00", "CAFM_Equipment_A00",
  "CAFM_WO_Event_A00", "CAFM_WO_Register_A00", "CAFM_AI_Conversation_A00", "CAFM_AI_Setting_A00",
  "CAFM_Handover_Pack_A00", "CAFM_Subcontractor_Technicians_A00", "CAFM_Checklist_Template_A00", "CAFM_WO_Checklist_A00", "CAFM_WO_Photos_A00", "CAFM_WO_Parts_A00", "CAFM_Permit_Controls_A00"];
const PROCESSES = ["CAFM_Work_Order_A00", "CAFM_Back_charge_A00", "CAFM_Permit_To_Work_A00"];
const BOARDS = ["CAFM_Snag_A00", "CAFM_Breakdown_A00"];

const dir = `backups/${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;
mkdirSync(dir, { recursive: true });
const save = (name, rows) => { writeFileSync(`${dir}/${name}.json`, JSON.stringify(rows, null, 1)); console.log(`${String(rows.length).padStart(5)}  ${name}`); };

for (const f of FORMS) {
  const all = [];
  for (let page = 1; ; page++) {
    const r = await kf("POST", `/form/2/{acc}/${f}/allitems/list${Q}&page_size=200&page_number=${page}`, {});
    const data = r.json?.Data ?? [];
    all.push(...data);
    if (data.length < 200) break;
  }
  save(f, all);
}
for (const p of PROCESSES) {
  const all = [];
  for (const view of ["draft", "inprogress", "completed", "rejected"]) {
    for (let page = 1; ; page++) {
      const r = await kf("POST", `/process/2/{acc}/${p}/myitems/${view}?apply_preference=false&page_number=${page}&page_size=200&_application_id=CAFM_POC_A00`, {});
      const data = r.json?.Data ?? [];
      all.push(...data.map((d) => ({ ...d, _view: view })));
      if (data.length < 200) break;
    }
  }
  save(p, all);
}
for (const b of BOARDS) {
  const r = await kf("GET", `/case/2/{acc}/${b}/list${Q}&page_size=500&page_number=1`);
  save(b, r.json?.Data ?? []);
}
console.log(`\nbacked up to data-model/${dir}`);
