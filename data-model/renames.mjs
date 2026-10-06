// Display-name renames (Q43). IDs never change; the IR keeps its technical names (stable gen ids),
// so this map is re-applied after any future apply-stage run (which would otherwise restore the old names).
import { kf } from "./kf-call.mjs";
export const RENAMES = {
  process: { CAFM_Work_Order_A00: "Work Order", CAFM_Back_charge_A00: "DLP Cost Recovery", CAFM_Permit_To_Work_A00: "Permit to Work" },
  case: { CAFM_Snag_A00: "Handover Snags", CAFM_Breakdown_A00: "Plant Breakdowns" },
  form: {
    CAFM_Site_A00: "Buildings & Facilities", CAFM_Unit_A00: "Apartments", CAFM_Asset_A00: "Asset Register", CAFM_Asset_Class_A00: "Asset Types",
    CAFM_Request_Category_A00: "Request Types", CAFM_Root_Cause_A00: "Fault Causes", CAFM_Subcontractor_A00: "Subcontractors", CAFM_SLA_Policy_A00: "SLA Targets",
    CAFM_PPM_Schedule_A00: "Planned Maintenance", CAFM_Compliance_Certificate_A00: "Compliance Certificates", CAFM_Equipment_A00: "Plant & Fleet",
    CAFM_WO_Event_A00: "Work Order Activity Log", CAFM_WO_Register_A00: "Work Order History",
    CAFM_AI_Conversation_A00: "AI Conversations", CAFM_AI_Setting_A00: "AI Settings"
  }
};
export const PREFIX = { CAFM_Snag_A00: "SNG", CAFM_Breakdown_A00: "BRK" };
if (process.argv[1].endsWith("renames.mjs")) {
  const mode = process.argv[2] ?? "check";
  const ex = (await kf("GET", "/flow/2/{acc}/explore?page_size=500&page_number=1")).json;
  const all = Array.isArray(ex) ? ex : ex.Data ?? [];
  const Q = "?_application_id=CAFM_POC_A00";
  for (const [type, m] of Object.entries(RENAMES)) for (const [id, name] of Object.entries(m)) {
    const clash = all.filter((f) => f.Name === name && f._id !== id);
    if (mode === "check") { console.log(`${clash.length ? "✗ clash" : "ok     "} ${id} → ${name}${clash.length ? " (" + clash.map((c) => c._id).join(",") + ")" : ""}`); continue; }
    if (mode === "one" && id !== "CAFM_SLA_Policy_A00") continue;
    if (clash.length) { console.log(`skip ${id}: name taken`); continue; }
    const body = { Name: name, ...(PREFIX[id] ? { Prefix: PREFIX[id] } : {}) };
    const r = await kf("PUT", `/flow/2/{acc}/${type}/${id}${Q}`, body);
    const g = await kf("GET", `/flow/2/{acc}/${type}/${id}${Q}`);
    console.log(`${r.status < 300 && g.json?.Name === name ? "✓" : "✗"} ${id} → ${g.json?.Name}${PREFIX[id] ? " prefix " + g.json?.Prefix : ""} (${r.status}${r.status >= 300 ? " " + JSON.stringify(r.json).slice(0, 150) : ""})`);
  }
}
