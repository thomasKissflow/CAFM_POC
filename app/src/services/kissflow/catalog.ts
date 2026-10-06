// Every flow in the CAFM Kissflow app, with its display name (BACKEND_CATALOG.md). Used by Admin → Data browser.
export type FlowKind = "process" | "board" | "dataform";
export interface FlowInfo { id: string; name: string; kind: FlowKind; group: "Work" | "Masters" | "Registers & logs" | "AI" }

export const CATALOG: FlowInfo[] = [
  { id: "CAFM_Work_Order_A00", name: "Work Order", kind: "process", group: "Work" },
  { id: "CAFM_Back_charge_A00", name: "DLP Cost Recovery", kind: "process", group: "Work" },
  { id: "CAFM_Permit_To_Work_A00", name: "Permit to Work", kind: "process", group: "Work" },
  { id: "CAFM_Snag_A00", name: "Handover Snags", kind: "board", group: "Work" },
  { id: "CAFM_Breakdown_A00", name: "Plant Breakdowns", kind: "board", group: "Work" },
  { id: "CAFM_Site_A00", name: "Buildings & Facilities", kind: "dataform", group: "Masters" },
  { id: "CAFM_Unit_A00", name: "Apartments", kind: "dataform", group: "Masters" },
  { id: "CAFM_Asset_A00", name: "Asset Register", kind: "dataform", group: "Masters" },
  { id: "CAFM_Asset_Class_A00", name: "Asset Types", kind: "dataform", group: "Masters" },
  { id: "CAFM_Request_Category_A00", name: "Request Types", kind: "dataform", group: "Masters" },
  { id: "CAFM_Root_Cause_A00", name: "Fault Causes", kind: "dataform", group: "Masters" },
  { id: "CAFM_Subcontractor_A00", name: "Subcontractors", kind: "dataform", group: "Masters" },
  { id: "CAFM_SLA_Policy_A00", name: "SLA Targets", kind: "dataform", group: "Masters" },
  { id: "CAFM_PPM_Schedule_A00", name: "Planned Maintenance", kind: "dataform", group: "Registers & logs" },
  { id: "CAFM_Compliance_Certificate_A00", name: "Compliance Certificates", kind: "dataform", group: "Registers & logs" },
  { id: "CAFM_Equipment_A00", name: "Plant & Fleet", kind: "dataform", group: "Registers & logs" },
  { id: "CAFM_WO_Event_A00", name: "Work Order Activity Log", kind: "dataform", group: "Registers & logs" },
  { id: "CAFM_WO_Register_A00", name: "Work Order History", kind: "dataform", group: "Registers & logs" },
  { id: "CAFM_AI_Conversation_A00", name: "AI Conversations", kind: "dataform", group: "AI" },
  { id: "CAFM_AI_Setting_A00", name: "AI Settings", kind: "dataform", group: "AI" }
];
