// Set one field's permission at given steps of a published process (in place; backs up the draft first), then publish.
// usage: node set-step-perm.mjs <PROCESS_ID> <Field_Id> <Level> "<Step name>" ["<Step name>" …]
import { writeFileSync } from "node:fs";
import { kf } from "./kf-call.mjs";
const [P, field, level, ...stepNames] = process.argv.slice(2);
const d = (await kf("GET", `/metadata/2/{acc}/process/${P}/draft`)).json;
writeFileSync(`kf-live/backup-${P}-${Date.now()}.json`, JSON.stringify(d));
const cols = Object.values(d).filter((o) => o && o.Kind === "Column" && (o["Column::Field"] || []).includes(field)).map((c) => c.Id);
const acts = Object.values(d).filter((o) => o && o.Kind === "Activity" && stepNames.includes(o.Name));
let changed = 0;
for (const p of Object.values(d)) if (p && p.Kind === "Permission" && cols.includes(p.Column) && acts.some((a) => a.Id === p.Activity) && p.Permission !== level) { p.Permission = level; changed++; }
console.log(`${field}: ${changed} step permission(s) → ${level} at ${acts.map((a) => a.Name).join(", ")}`);
const put = await kf("PUT", `/metadata/2/{acc}/process/${P}/draft`, d); console.log("PUT draft", put.status);
if (put.status < 300 && changed) { const pub = await kf("POST", `/metadata/2/{acc}/process/${P}/publish`, {}); console.log("publish", pub.status); }
