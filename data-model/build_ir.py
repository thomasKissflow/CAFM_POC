# Money is stored as Number in AED: Currency fields hold text ("3.5 AED") and every Currency formula
# returned null in the runtime sandbox (22 Sep), while Number arithmetic works.
# Generates app-spec.json (Kissflow App Agents IR) for the CAFM POC data model. Phase 3: DESIGN ONLY.
import json

R = ["Executive", "FM Manager", "Helpdesk", "DLP Manager", "Subcontractor Supervisor", "Technician",
     "Resident", "Compliance Officer", "HSE Officer", "Plant Manager"]

def f(name, type, **kw):
    d = {"name": name, "type": type}; d.update(kw); return d

lists = [
  {"name": "CAFM Priority", "items": ["P1", "P2", "P3", "P4"]},
  {"name": "CAFM Channel", "items": ["Resident app", "QR poster", "Phone call", "Helpdesk", "PPM schedule", "Email", "WhatsApp", "BMS alarm", "Voice agent"]},
  {"name": "CAFM Trade", "items": ["HVAC", "Lifts", "Fire", "Electrical", "Plumbing", "Facade", "Finishes"]},
  {"name": "CAFM Site Kind", "items": ["Residential tower", "Site office", "Labour accommodation", "Plant yard"]},
  {"name": "CAFM Asset Status", "items": ["Operational", "Degraded", "Down"]},
  {"name": "CAFM Liability", "items": ["DLP", "CHARGEABLE", "DECENNIAL_REVIEW", "WARRANTY", "OWN_OPS", "PPM"]},
  {"name": "CAFM Photo Kind", "items": ["Report", "Before", "After"]},
  {"name": "CAFM Compliance System", "items": ["Civil Defence certificate", "Fire alarm", "Sprinklers", "Fire pumps", "Emergency lighting", "Extinguishers", "Hassantuk link", "Lift inspection", "Water tank cleaning", "Lifting equipment TPI"]},
  {"name": "CAFM Hassantuk Status", "items": ["Connected", "Fault", "Not applicable"]},
  {"name": "CAFM PPM Frequency", "items": ["Monthly", "Quarterly", "Every 6 months", "Annual"]},
  {"name": "CAFM Permit Type", "items": ["Hot work", "Work at height", "Electrical isolation", "Confined space"]},
  {"name": "CAFM Equipment Type", "items": ["Crawler crane", "Mobile crane", "Tower crane", "Excavator", "Wheel loader", "Tipper", "Low-bed trailer", "Generator", "Compressor", "Piling rig"]},
  {"name": "CAFM Equipment Status", "items": ["Working", "Idle", "Breakdown", "In service"]},
  {"name": "CAFM Subcontractor Response", "items": ["Accept", "Dispute"]},
  {"name": "CAFM Event Type", "items": ["Created", "AI triage", "Liability flagged", "Dispatched", "Arrived", "Diagnosis challenge", "Root cause", "Reclassified", "Resolved", "Verified", "Closed", "SLA breach", "Back-charge raised", "Back-charge recovered", "Step changed", "Comment"]},
  {"name": "CAFM Language", "items": ["English", "Arabic"]},
]

forms = []
# ---------------- masters (Dataforms) ----------------
forms.append({"name": "CAFM Site", "flowType": "Form", "fields": [
  f("Site Code", "Text", required=True, section="Identity"), f("Site Name", "Text", required=True, section="Identity"),
  f("Site Name AR", "Text", section="Identity"), f("District", "Text", section="Identity"),
  f("Site Kind", "Select", referredList="CAFM Site Kind", required=True, section="Identity"),
  f("Client Name", "Text", section="Identity"), f("Own Operations", "Boolean", section="Identity"),
  f("TOC Date", "Date", section="Liability"), f("DLP Months", "Number", section="Liability"),
  f("DLP End Date", "Date", section="Liability"), f("Decennial End Date", "Date", section="Liability"),
  f("Floors", "Number", section="Size"), f("Unit Count", "Number", section="Size"), f("Beds", "Number", section="Size")],
  "child_tables": [{"name": "Handover Pack", "fields": [
    f("Pack Item", "Text", required=True), f("Received", "Boolean"), f("Received On", "Date"), f("Item Count", "Number"), f("Pack Document", "Attachment")]}]})
forms.append({"name": "CAFM Subcontractor", "flowType": "Form", "fields": [
  f("Company Name", "Text", required=True, section="Company"), f("Company Name AR", "Text", section="Company"),
  f("Trade", "Select", referredList="CAFM Trade", required=True, section="Company"),
  f("Supervisor", "User", section="Company"), f("Contact Email", "Email", section="Company"),
  f("Trade Licence No", "Text", section="Documents"), f("Trade Licence Expiry", "Date", section="Documents"),
  f("Insurance Expiry", "Date", section="Documents"), f("Civil Defence Approved", "Boolean", section="Documents"),
  f("Civil Defence Approval Expiry", "Date", section="Documents"),
  f("Licence Days Left", "Number", section="Documents", formula='IF(ABS(YEAR(Trade_Licence_Expiry) * 372 + MONTH(Trade_Licence_Expiry) * 31 + DAY(Trade_Licence_Expiry) - (YEAR(TODAY()) * 372 + MONTH(TODAY()) * 31 + DAY(TODAY()))) = YEAR(Trade_Licence_Expiry) * 372 + MONTH(Trade_Licence_Expiry) * 31 + DAY(Trade_Licence_Expiry) - (YEAR(TODAY()) * 372 + MONTH(TODAY()) * 31 + DAY(TODAY())), DATEDIFF(TODAY(), Trade_Licence_Expiry, "Day"), 0 - DATEDIFF(TODAY(), Trade_Licence_Expiry, "Day"))')],
  "child_tables": [{"name": "Subcontractor Technicians", "fields": [f("Technician", "User", required=True), f("Skill", "Text")]}]})
forms.append({"name": "CAFM Unit", "flowType": "Form", "fields": [
  f("Unit Number", "Text", required=True), f("Site", "Reference", ref="CAFM Site", required=True, lookup=[{"name": "Site Name", "type": "Text"}]),
  f("Floor", "Number"), f("Resident", "User")]})
forms.append({"name": "CAFM Asset Class", "flowType": "Form", "fields": [
  f("Class Code", "Text", required=True), f("Class Name", "Text", required=True), f("Class Name AR", "Text"),
  f("Trade", "Select", referredList="CAFM Trade", required=True), f("Warranty Months", "Number"),
  f("PPM Frequency", "Select", referredList="CAFM PPM Frequency")],
  "child_tables": [{"name": "Checklist Template", "fields": [f("Check Step", "Text", required=True), f("Check Step AR", "Text"), f("Needs Reading", "Boolean")]}]})
forms.append({"name": "CAFM Request Category", "flowType": "Form", "fields": [
  f("Category Code", "Text", required=True), f("Category Name", "Text", required=True), f("Category Name AR", "Text"),
  f("Trade", "Select", referredList="CAFM Trade"), f("Base Priority", "Select", referredList="CAFM Priority", required=True),
  f("Summer Uplift", "Boolean"), f("Structural", "Boolean")]})
forms.append({"name": "CAFM Root Cause", "flowType": "Form", "fields": [
  f("Root Cause Code", "Text", required=True), f("Root Cause Name", "Text", required=True), f("Root Cause Name AR", "Text"),
  f("Trade", "Select", referredList="CAFM Trade"), f("Excluded From DLP", "Boolean")]})
forms.append({"name": "CAFM SLA Policy", "flowType": "Form", "fields": [
  f("Priority", "Select", referredList="CAFM Priority", required=True), f("Response Minutes", "Number", required=True),
  f("Resolve Minutes", "Number", required=True), f("At Risk Percent", "Number")]})
forms.append({"name": "CAFM Asset", "flowType": "Form", "fields": [
  f("Asset Tag", "Text", required=True, section="Identity"), f("QR Code", "Text", section="Identity"),
  f("Site", "Reference", ref="CAFM Site", required=True, section="Location", lookup=[{"name": "Site Name", "type": "Text"}, {"name": "Own Operations", "type": "Boolean"}]),
  f("Unit", "Reference", ref="CAFM Unit", section="Location", lookup=[{"name": "Unit Number", "type": "Text"}]),
  f("Floor", "Number", section="Location"), f("Location", "Text", section="Location"), f("Location AR", "Text", section="Location"),
  f("Asset Class", "Reference", ref="CAFM Asset Class", required=True, section="Identity", lookup=[{"name": "Class Name", "type": "Text"}, {"name": "Trade", "type": "Select"}]),
  f("Make", "Text", section="Identity"), f("Model", "Text", section="Identity"), f("Serial Number", "Text", section="Identity"),
  f("Installed By", "Reference", ref="CAFM Subcontractor", section="Liability", lookup=[{"name": "Company Name", "type": "Text"}, {"name": "Supervisor", "type": "User"}]),
  f("Batch", "Text", section="Liability"), f("Handover Date", "Date", section="Liability"),
  f("DLP End Date", "Date", section="Liability"), f("Warranty End Date", "Date", section="Liability"), f("Decennial End Date", "Date", section="Liability"),
  f("Asset Status", "Select", referredList="CAFM Asset Status", section="Identity"), f("Asset Photo", "Image", section="Identity")]})
forms.append({"name": "CAFM PPM Schedule", "flowType": "Form", "fields": [
  f("Schedule Title", "Text", required=True), f("Schedule Title AR", "Text"),
  f("Site", "Reference", ref="CAFM Site", required=True, lookup=[{"name": "Site Name", "type": "Text"}]),
  f("Asset Class", "Reference", ref="CAFM Asset Class", required=True, lookup=[{"name": "Class Name", "type": "Text"}]),
  f("Frequency", "Select", referredList="CAFM PPM Frequency", required=True), f("Asset Count", "Number"),
  f("Contractor", "Reference", ref="CAFM Subcontractor", lookup=[{"name": "Company Name", "type": "Text"}]),
  f("Next Due Date", "Date"), f("Active", "Boolean")]})
forms.append({"name": "CAFM Compliance Certificate", "flowType": "Form", "fields": [
  f("Site", "Reference", ref="CAFM Site", required=True, lookup=[{"name": "Site Name", "type": "Text"}]),
  f("Compliance System", "Select", referredList="CAFM Compliance System", required=True),
  f("Contractor", "Reference", ref="CAFM Subcontractor", lookup=[{"name": "Company Name", "type": "Text"}]),
  f("Certificate No", "Text"), f("Issued On", "Date"), f("Expires On", "Date", required=True), f("Last Inspection", "Date"),
  f("Open Findings", "Number"), f("Hassantuk Status", "Select", referredList="CAFM Hassantuk Status"),
  f("Evidence", "Attachment"), f("Days To Expiry", "Number", formula='IF(ABS(YEAR(Expires_On) * 372 + MONTH(Expires_On) * 31 + DAY(Expires_On) - (YEAR(TODAY()) * 372 + MONTH(TODAY()) * 31 + DAY(TODAY()))) = YEAR(Expires_On) * 372 + MONTH(Expires_On) * 31 + DAY(Expires_On) - (YEAR(TODAY()) * 372 + MONTH(TODAY()) * 31 + DAY(TODAY())), DATEDIFF(TODAY(), Expires_On, "Day"), 0 - DATEDIFF(TODAY(), Expires_On, "Day"))')]})
forms.append({"name": "CAFM Equipment", "flowType": "Form", "fields": [
  f("Fleet No", "Text", required=True), f("Equipment Type", "Select", referredList="CAFM Equipment Type", required=True),
  f("Make", "Text"), f("Model", "Text"), f("Year", "Number"), f("Current Project", "Text"),
  f("Hour Meter", "Number"), f("Next Service Hours", "Number"), f("Hours To Service", "Number", formula="Next_Service_Hours - Hour_Meter"),
  f("TPI Expiry", "Date"), f("Equipment Status", "Select", referredList="CAFM Equipment Status")]})

# ---------------- Work Order (Process) ----------------
wo_fields = [
  # request (initiator)
  f("Site", "Reference", ref="CAFM Site", required=True, section="Request", autofill=True, lookup=[{"name": "Site Name", "type": "Text"}, {"name": "Own Operations", "type": "Boolean"}]),
  f("Unit", "Reference", ref="CAFM Unit", section="Request", lookup=[{"name": "Unit Number", "type": "Text"}]),
  f("Category", "Reference", ref="CAFM Request Category", required=True, section="Request",
    autofill=True, lookup=[{"name": "Category Name", "type": "Text"}, {"name": "Base Priority", "type": "Select"}, {"name": "Summer Uplift", "type": "Boolean"}, {"name": "Structural", "type": "Boolean"}]),
  f("Request Title", "Text", required=True, section="Request"), f("Description", "Textarea", section="Request"),
  f("Description Language", "Select", referredList="CAFM Language", section="Request"),
  f("Channel", "Select", referredList="CAFM Channel", required=True, section="Request"),
  f("Reporter Name", "Text", section="Request"), f("First Contact At", "DateTime", required=True, section="Request"),
  # voice agent capture (resident app): full call transcript plus the two facts that change dispatch
  f("Conversation Transcript", "Textarea", section="Request"), f("Vulnerable Occupant", "Boolean", section="Request"),
  f("Access Window", "Text", section="Request"),
  # triage & liability
  f("Asset", "Reference", ref="CAFM Asset", section="Triage", autofill=True,
    lookup=[{"name": "Asset Tag", "type": "Text"}, {"name": "DLP End Date", "type": "Date"}, {"name": "Warranty End Date", "type": "Date"}, {"name": "Decennial End Date", "type": "Date"}, {"name": "Batch", "type": "Text"}]),
  f("Own Operations", "Boolean", section="Liability data"), f("Base Priority", "Text", section="Liability data"),
  f("Summer Uplift", "Boolean", section="Liability data"), f("Structural", "Boolean", section="Liability data"),
  f("Asset Tag", "Text", section="Liability data"), f("DLP End Date", "Date", section="Liability data"), f("Warranty End Date", "Date", section="Liability data"),
  f("Decennial End Date", "Date", section="Liability data"), f("Batch", "Text", section="Liability data"),
  f("Installed By", "Reference", ref="CAFM Subcontractor", section="Triage", lookup=[{"name": "Company Name", "type": "Text"}, {"name": "Supervisor", "type": "User"}]),
  f("Report Month", "Number", section="Triage", formula="MONTH(First_Contact_At)"),
  # Formulas use only forms proven at runtime in the sandbox (22 Sep): =, 2-arg AND/OR, IF, ABS, + - *,
  # MONTH/YEAR/DAY, TODAY. NOT, >=, <=, >, 4-arg OR, ISBLANK and DATEDIFF on DateTime returned null.
  # The runtime evaluates formulas in ~3 passes, so a chain deeper than 3 reads stale values: each formula
  # below reads input fields directly (depth 1), and nothing sits deeper than depth 3.
  f("Summer Flag", "Number", section="Triage", formula="IF(Summer_Uplift, IF(MONTH(First_Contact_At) = 6, 1, IF(MONTH(First_Contact_At) = 7, 1, IF(MONTH(First_Contact_At) = 8, 1, IF(MONTH(First_Contact_At) = 9, 1, 0)))), 0)"),
  # Text formulas can't read numbers (engine types every node as the output type), so decisions are Number codes.
  # Priority Code: 1..4 = P1..P4 (summer AC uplift P3 -> P2).  Liability Code: 1 DLP, 2 CHARGEABLE, 3 DECENNIAL_REVIEW, 4 WARRANTY, 5 OWN_OPS.
  f("Priority Code", "Number", section="Triage", formula='IF(Base_Priority = "P1", 1, IF(Base_Priority = "P2", 2, IF(Base_Priority = "P3", IF(Summer_Flag = 1, 2, 3), 4)))'),
  f("Response Minutes", "Number", section="Triage", formula="IF(Priority_Code = 1, 30, IF(Priority_Code = 2, 60, IF(Priority_Code = 3, 240, 1440)))"),
  f("Resolve Minutes", "Number", section="Triage", formula="IF(Priority_Code = 1, 240, IF(Priority_Code = 2, 480, IF(Priority_Code = 3, 4320, 14400)))"),
  f("Root Cause", "Reference", ref="CAFM Root Cause", section="Execution", autofill=True, lookup=[{"name": "Root Cause Name", "type": "Text"}, {"name": "Excluded From DLP", "type": "Boolean"}]),
  f("Excluded From DLP", "Boolean", section="Liability data"),
  # Date order via a sortable key (YEAR*372 + MONTH*31 + DAY): the gap's sign says before/after, and ABS(x) = x means x >= 0.
  # A blank end date gives key 0, so a negative gap means not covered.
  f("DLP Covered", "Number", section="Triage", formula="IF(ABS(YEAR(DLP_End_Date) * 372 + MONTH(DLP_End_Date) * 31 + DAY(DLP_End_Date) - (YEAR(First_Contact_At) * 372 + MONTH(First_Contact_At) * 31 + DAY(First_Contact_At))) = YEAR(DLP_End_Date) * 372 + MONTH(DLP_End_Date) * 31 + DAY(DLP_End_Date) - (YEAR(First_Contact_At) * 372 + MONTH(First_Contact_At) * 31 + DAY(First_Contact_At)), 1, 0)"),
  f("Warranty Covered", "Number", section="Triage", formula="IF(ABS(YEAR(Warranty_End_Date) * 372 + MONTH(Warranty_End_Date) * 31 + DAY(Warranty_End_Date) - (YEAR(First_Contact_At) * 372 + MONTH(First_Contact_At) * 31 + DAY(First_Contact_At))) = YEAR(Warranty_End_Date) * 372 + MONTH(Warranty_End_Date) * 31 + DAY(Warranty_End_Date) - (YEAR(First_Contact_At) * 372 + MONTH(First_Contact_At) * 31 + DAY(First_Contact_At)), 1, 0)"),
  f("Liability Code", "Number", section="Triage", formula="IF(Own_Operations, 5, IF(Structural, 3, IF(Excluded_From_DLP, 2, IF(DLP_Covered = 1, 1, IF(Warranty_Covered = 1, 4, 2)))))"),
  # Dispatch Code: 1 installing subcontractor (DLP / warranty), 2 FM team (chargeable / own ops), 3 engineering review (decennial).
  f("Dispatch Code", "Number", section="Triage", formula="IF(Liability_Code = 1, 1, IF(Liability_Code = 4, 1, IF(Liability_Code = 3, 3, 2)))"),
  f("AI Suggested Category", "Text", section="Triage"), f("AI Confidence", "Number", section="Triage"),
  # dispatch
  f("Assigned Technician", "User", section="Dispatch"), f("Accepted At", "DateTime", section="Dispatch"),
  # execution (technician)
  f("Arrived At", "DateTime", section="Execution"), f("On Hold Reason", "Text", section="Execution"),
  f("Supply Air Reading", "Number", section="Execution"), f("Diagnosis Challenge Shown", "Boolean", section="Execution"),
  f("Challenge Acknowledged", "Boolean", section="Execution"), f("Closeout Note", "Textarea", section="Execution"),
  f("Labour AED", "Number", section="Execution"),
  f("Occupant Signature", "Image", section="Execution"), f("Resolved At", "DateTime", section="Execution"),
  # verification
  f("Verified At", "DateTime", section="Verification"), f("Back-charge Ref", "Text", section="Verification"),
]
forms.append({"name": "CAFM Work Order", "flowType": "Process", "fields": wo_fields,
  "child_tables": [
    {"name": "WO Checklist", "fields": [f("Check Step", "Text", required=True), f("Done", "Boolean"), f("Reading", "Text")]},
    {"name": "WO Photos", "fields": [f("Photo", "Image", required=True), f("Photo Kind", "Select", referredList="CAFM Photo Kind"), f("Caption", "Text")]},
    {"name": "WO Parts", "fields": [f("Part", "Text", required=True), f("Qty", "Number"), f("Unit Cost AED", "Number"), f("Line Total AED", "Number", formula="Qty * Unit_Cost_AED")]}],
  "workflow": {"steps": [
    {"name": "Request raised", "actor": "Resident", "field_permissions": {"Triage": "Hidden", "Liability data": "Hidden", "Dispatch": "Hidden", "Execution": "Hidden", "Verification": "Hidden", "WO Checklist": "Hidden", "WO Parts": "Hidden"}},
    {"name": "Triage", "actor": "Helpdesk", "field_permissions": {"Triage": "Editable", "Request": "Editable"}},
    {"name": "Subcontractor dispatch", "actor": "Subcontractor Supervisor", "condition": 'Dispatch_Code = 1', "field_permissions": {"Dispatch": "Editable"}},
    {"name": "FM dispatch", "actor": "FM Manager", "condition": 'Dispatch_Code = 2', "field_permissions": {"Dispatch": "Editable"}},
    {"name": "Engineering review", "actor": "DLP Manager", "condition": 'Dispatch_Code = 3', "field_permissions": {"Dispatch": "Editable", "Execution": "Editable"}},
    {"name": "Work in progress", "actor": "Technician", "field_permissions": {"Execution": "Editable", "WO Checklist": "Editable", "WO Photos": "Editable", "WO Parts": "Editable", "Root Cause": "Editable"}},
    {"name": "Verify and close", "actor": "Helpdesk", "field_permissions": {"Verification": "Editable"}},
    {"name": "Closed"}]}})
# aggregate: parts total
forms[-1]["fields"].append(f("Parts AED", "Number", section="Execution", aggregate={"fn": "SUM", "over": "WO Parts", "field": "Line Total AED"}))

forms.append({"name": "CAFM Back-charge", "flowType": "Process", "fields": [
  f("Work Order No", "Text", required=True), f("Work Order Instance", "Text"),
  f("Subcontractor", "Reference", ref="CAFM Subcontractor", required=True, lookup=[{"name": "Company Name", "type": "Text"}, {"name": "Supervisor", "type": "User"}]),
  f("Site", "Reference", ref="CAFM Site", lookup=[{"name": "Site Name", "type": "Text"}]),
  f("Root Cause", "Reference", ref="CAFM Root Cause", lookup=[{"name": "Root Cause Name", "type": "Text"}]),
  f("Parts AED", "Number"), f("Labour AED", "Number"),
  f("Total AED", "Number", formula="Parts_AED + Labour_AED"),
  f("Subcontractor Response", "Select", referredList="CAFM Subcontractor Response", section="Response"),
  f("Dispute Reason", "Textarea", section="Response"),
  f("Agreed AED", "Number", section="Settlement"), f("Recovered On", "Date", section="Settlement")],
  "workflow": {"steps": [
    {"name": "Back-charge raised", "actor": "DLP Manager"},
    {"name": "Subcontractor response", "actor": "Subcontractor Supervisor", "field_permissions": {"Response": "Editable"}},
    {"name": "Dispute review", "actor": "DLP Manager", "condition": 'Subcontractor_Response = "Dispute"', "field_permissions": {"Settlement": "Editable"}},
    {"name": "Recovery confirmation", "actor": "DLP Manager", "field_permissions": {"Settlement": "Editable"}},
    {"name": "Recovered"}]}})

forms.append({"name": "CAFM Permit To Work", "flowType": "Process", "fields": [
  f("Permit Type", "Select", referredList="CAFM Permit Type", required=True),
  f("Site", "Reference", ref="CAFM Site", required=True, lookup=[{"name": "Site Name", "type": "Text"}]),
  f("Work Order No", "Text"), f("Work Location", "Text", required=True),
  f("Valid From", "DateTime", required=True), f("Valid To", "DateTime", required=True),
  f("Gas Test Reading", "Text"), f("Isolation Points", "Textarea"), f("Approval Note", "Textarea", section="HSE"),
  f("Closed Out At", "DateTime", section="Close-out")],
  "child_tables": [{"name": "Permit Controls", "fields": [f("Control", "Text", required=True), f("Confirmed", "Boolean")]}],
  "workflow": {"steps": [
    {"name": "Permit requested", "actor": "Technician"},
    {"name": "HSE approval", "actor": "HSE Officer", "field_permissions": {"HSE": "Editable"}},
    {"name": "Work active", "actor": "Technician", "field_permissions": {"Permit Controls": "Editable", "Close-out": "Editable"}},
    {"name": "HSE close-out", "actor": "HSE Officer", "field_permissions": {"HSE": "Editable"}},
    {"name": "Permit closed"}]}})

forms.append({"name": "CAFM WO Event", "flowType": "Form", "fields": [
  f("Work Order No", "Text", required=True), f("Work Order Instance", "Text"),
  f("Event Type", "Select", referredList="CAFM Event Type", required=True), f("Event At", "DateTime", required=True),
  f("Actor", "User"), f("Actor Label", "Text"), f("Event Detail", "Textarea")]})

# Reporting register: one row per work order (seeded history + live mirror written by integrations).
# Dashboards read this instead of process items (no backdating of process items; no flow-admin needed).
forms.append({"name": "CAFM WO Register", "flowType": "Form", "fields": [
  f("Work Order No", "Text", required=True, section="Identity"), f("Work Order Instance", "Text", section="Identity"),
  f("Site", "Reference", ref="CAFM Site", section="Identity", lookup=[{"name": "Site Name", "type": "Text"}]),
  f("Unit Number", "Text", section="Identity"), f("Asset Tag", "Text", section="Identity"), f("Batch", "Text", section="Identity"),
  f("Category Name", "Text", section="Identity"), f("Channel", "Select", referredList="CAFM Channel", section="Identity"),
  f("Priority", "Select", referredList="CAFM Priority", section="Clock"), f("Summer Uplift", "Boolean", section="Clock"),
  f("Liability", "Select", referredList="CAFM Liability", section="Liability"), f("Current Step", "Text", section="Clock"),
  f("Priority Code", "Number", section="Clock"), f("Liability Code", "Number", section="Liability"),
  f("First Contact At", "DateTime", section="Clock"), f("Response Due At", "DateTime", section="Clock"), f("Resolve Due At", "DateTime", section="Clock"),
  f("Responded At", "DateTime", section="Clock"), f("Resolved At", "DateTime", section="Clock"), f("Closed At", "DateTime", section="Clock"),
  f("Subcontractor", "Reference", ref="CAFM Subcontractor", section="Liability", lookup=[{"name": "Company Name", "type": "Text"}]),
  f("Technician", "User", section="Liability"), f("Root Cause Name", "Text", section="Liability"),
  f("Parts AED", "Number", section="Cost"), f("Labour AED", "Number", section="Cost"),
  f("Total Cost AED", "Number", section="Cost", formula="Parts_AED + Labour_AED"),
  f("Back-charge Ref", "Text", section="Cost"), f("Back-charge Status", "Text", section="Cost"), f("Recovered On", "Date", section="Cost")]})

# ---------------- Boards (Case) ----------------
forms.append({"name": "CAFM Snag", "flowType": "Case", "fields": [
  f("Site", "Reference", ref="CAFM Site", required=True, lookup=[{"name": "Site Name", "type": "Text"}]),
  f("Unit", "Reference", ref="CAFM Unit", lookup=[{"name": "Unit Number", "type": "Text"}]),
  f("Trade", "Select", referredList="CAFM Trade"),
  f("Subcontractor", "Reference", ref="CAFM Subcontractor", lookup=[{"name": "Company Name", "type": "Text"}]),
  f("Snag Location", "Text"), f("Snag Photo", "Image")],
  "caseflow": {"statuses": [{"name": "Open", "category": "NotStarted"}, {"name": "In progress", "category": "InProgress"},
    {"name": "Ready for inspection", "category": "InProgress"}, {"name": "Carried into DLP", "category": "InProgress"}, {"name": "Closed", "category": "Done"}]}})
forms.append({"name": "CAFM Breakdown", "flowType": "Case", "fields": [
  f("Equipment", "Reference", ref="CAFM Equipment", required=True, lookup=[{"name": "Fleet No", "type": "Text"}, {"name": "Model", "type": "Text"}]),
  f("Reported At", "DateTime"), f("Downtime Hours", "Number"), f("Repair Cost AED", "Number")],
  "caseflow": {"statuses": [{"name": "Reported", "category": "NotStarted"}, {"name": "Diagnosing", "category": "InProgress"},
    {"name": "Awaiting parts", "category": "InProgress"}, {"name": "Under repair", "category": "InProgress"}, {"name": "Back in service", "category": "Done"}]}})

ALL = "Executive,FM Manager,Helpdesk,DLP Manager,Subcontractor Supervisor,Technician,Resident,Compliance Officer,HSE Officer,Plant Manager".split(",")
perm = []
def p(role, model, level, scope="all"): perm.append({"role": role, "model": model, "level": level, "scope": scope})
masters = ["CAFM Site", "CAFM Unit", "CAFM Asset Class", "CAFM Request Category", "CAFM Root Cause", "CAFM SLA Policy", "CAFM Subcontractor", "CAFM Asset"]
for m in masters:
    for r in ALL: p(r, m, "ReadOnly")
for r in ["FM Manager", "DLP Manager"]:
    for m in masters: perm[:] = [x for x in perm if not (x["role"] == r and x["model"] == m)]; p(r, m, "Editable")
# work orders
p("Resident", "CAFM Work Order", "Editable", "my-items"); p("Helpdesk", "CAFM Work Order", "Editable", "all")
p("FM Manager", "CAFM Work Order", "Editable", "all"); p("DLP Manager", "CAFM Work Order", "Editable", "all")
p("Subcontractor Supervisor", "CAFM Work Order", "Editable", "my-items"); p("Technician", "CAFM Work Order", "Editable", "my-items")
p("Executive", "CAFM Work Order", "ReadOnly", "all")
p("DLP Manager", "CAFM Back-charge", "Editable", "all"); p("Subcontractor Supervisor", "CAFM Back-charge", "Editable", "my-items"); p("Executive", "CAFM Back-charge", "ReadOnly", "all")
p("Technician", "CAFM Permit To Work", "Editable", "my-items"); p("HSE Officer", "CAFM Permit To Work", "Editable", "all"); p("FM Manager", "CAFM Permit To Work", "ReadOnly", "all")
for r in ALL:
    if r != "Resident": p(r, "CAFM WO Event", "ReadOnly", "all")
for r in ["Executive", "FM Manager", "Helpdesk", "DLP Manager", "Compliance Officer"]: p(r, "CAFM WO Register", "ReadOnly", "all")
p("Subcontractor Supervisor", "CAFM WO Register", "ReadOnly", "my-items")
p("DLP Manager", "CAFM Snag", "Editable", "all"); p("Subcontractor Supervisor", "CAFM Snag", "Editable", "my-items"); p("Executive", "CAFM Snag", "ReadOnly", "all")
p("Compliance Officer", "CAFM Compliance Certificate", "Editable", "all"); p("FM Manager", "CAFM Compliance Certificate", "ReadOnly", "all"); p("Executive", "CAFM Compliance Certificate", "ReadOnly", "all")
p("FM Manager", "CAFM PPM Schedule", "Editable", "all"); p("Compliance Officer", "CAFM PPM Schedule", "ReadOnly", "all")
p("Plant Manager", "CAFM Equipment", "Editable", "all"); p("Executive", "CAFM Equipment", "ReadOnly", "all")
p("Plant Manager", "CAFM Breakdown", "Editable", "all"); p("Executive", "CAFM Breakdown", "ReadOnly", "all")

# ---- Phase 7 (22 Sep): AI conversations + AI settings (Thomas approved) ----
forms.append({"name": "CAFM AI Conversation", "flowType": "Form", "fields": [
  f("Session Id", "Text", required=True, section="Call"), f("Started At", "DateTime", section="Call"), f("Ended At", "DateTime", section="Call"),
  f("Duration Seconds", "Number", section="Call"), f("Language", "Select", referredList="CAFM Language", section="Call"),
  f("Caller Name", "Text", section="Call"), f("Caller Role", "Text", section="Call"), f("Voice Engine", "Text", section="Call"), f("Model", "Text", section="Call"),
  f("Work Order Ref", "Text", section="Call"), f("Work Order Instance", "Text", section="Call"),
  f("Transcript", "Textarea", section="Transcript"),
  f("Summary", "Textarea", section="Summary"), f("Key Points", "Textarea", section="Summary"), f("Action Items", "Textarea", section="Summary"), f("Open Questions", "Textarea", section="Summary"),
  f("Sentiment", "Text", section="Insights"), f("Intents", "Textarea", section="Insights"), f("Issues Raised", "Textarea", section="Insights"), f("Suggested Follow Ups", "Textarea", section="Insights"),
  f("Insights JSON", "Textarea", section="Insights"),
  f("Input Tokens", "Number", section="Usage"), f("Output Tokens", "Number", section="Usage"), f("Total Tokens", "Number", section="Usage")]})
forms.append({"name": "CAFM AI Setting", "flowType": "Form", "fields": [
  f("Setting Key", "Text", required=True), f("Setting Value", "Textarea"), f("Updated By", "Text"), f("Updated At", "DateTime")]})
for r in ["Resident", "Helpdesk"]: p(r, "CAFM AI Conversation", "Editable", "my-items" if r == "Resident" else "all")
for r in ["Executive", "FM Manager", "DLP Manager"]: p(r, "CAFM AI Conversation", "ReadOnly", "all")

# Child tables: the engine builds them only as SIBLING forms + ir.childTables links
# (a nested forms[].child_tables[] is silently dropped by the builder — see lower.mjs comment).
childTables = []
for fm in list(forms):
    cts = fm.pop("child_tables", []) or []
    for ct in cts:
        forms.append({"name": ct["name"], "flowType": "Form", "fields": ct["fields"]})
        childTables.append({"parent": fm["name"], "child": ct["name"], "field": ct["name"]})
    # name-only stubs: lets the IR validator accept step permissions keyed by table name
    # (the builder ignores nested child_tables and builds from the sibling forms above)
    if cts: fm["child_tables"] = [{"name": ct["name"]} for ct in cts]

ir = {"app": {"name": "CAFM - POC", "id": "CAFM_POC_A00", "description": "Contractor-shaped CAFM for Dutco Construction (demo): handover, DLP liability, work orders, compliance, plant."},
      "roles": [{"name": r} for r in R], "lists": lists, "forms": forms, "childTables": childTables, "permissions": perm}
json.dump(ir, open("app-spec.json", "w"), indent=2, ensure_ascii=False)
print("forms", len(forms), "lists", len(lists), "fields", sum(len(x["fields"]) for x in forms), "perms", len(perm))
