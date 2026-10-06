// Work Order: let the app's create write every field it sends (22 Sep, found via a wrong Category on voice-raised WOs).
// Kissflow drops a lookup whose autofill targets fields hidden at the step, then stores the lookup's FIRST row instead
// (every new WO became "AC not cooling" / FCU-1402-01). Fix: autofill off on Category + Asset (the app writes the copy
// fields itself, DATA_MODEL §16) and make the create fields Editable at "Request raised". Backs up the draft first.
// 1 Oct: the same bug hid on Site while there was only one building — every work order silently stored Qamar.
// Site is now in the list too; the app copies Own Operations / DLP End Date / Base Priority itself either way.
// usage: node fix-create-fields.mjs [--publish]
import { writeFileSync } from "node:fs";
import { kf } from "./kf-call.mjs";
const P = "CAFM_Work_Order_A00", publish = process.argv.includes("--publish");
const FIELDS = ["Site", "Unit", "Category", "Asset", "Installed_By", "Own_Operations", "Base_Priority", "Summer_Uplift", "Structural",
  "DLP_End_Date", "Warranty_End_Date", "Asset_Tag", "Batch", "Vulnerable_Occupant", "Access_Window", "Conversation_Transcript"];
const d = (await kf("GET", `/metadata/2/{acc}/process/${P}/draft`)).json;
writeFileSync(`kf-live/backup-${P}-${Date.now()}.json`, JSON.stringify(d));
let autofill = 0, perms = 0;
for (const f of ["Site", "Unit", "Category", "Asset"]) for (const q of d[f]["Field::QueryDefinition"] || []) if (d[q].AutoFill !== false) { d[q].AutoFill = false; autofill++; }
const start = Object.values(d).find((o) => o && o.Kind === "Activity" && o.Name === "Request raised");
const cols = new Set(Object.values(d).filter((o) => o && o.Kind === "Column" && (o["Column::Field"] || []).some((x) => FIELDS.includes(x))).map((c) => c.Id));
for (const p of Object.values(d)) if (p && p.Kind === "Permission" && cols.has(p.Column) && p.Activity === start.Id && p.Permission !== "Editable") { p.Permission = "Editable"; perms++; }
console.log(`autofill off: ${autofill} · start-step permissions → Editable: ${perms} (of ${cols.size} fields found)`);
const put = await kf("PUT", `/metadata/2/{acc}/process/${P}/draft`, d);
console.log("PUT draft", put.status, put.status >= 300 ? JSON.stringify(put.json).slice(0, 300) : "");
if (publish && put.status < 300) { const pub = await kf("POST", `/metadata/2/{acc}/process/${P}/publish`, {}); console.log("publish", pub.status, pub.status >= 300 ? JSON.stringify(pub.json).slice(0, 300) : ""); }
