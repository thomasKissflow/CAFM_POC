// Adds the missing Column::Permission back-refs to a published process so its per-step field permissions
// take effect (the engine emits Activity::Permission only). Idempotent. usage: node fix-step-perms.mjs <PROCESS_ID> [--publish]
import { writeFileSync } from "node:fs";
import { kf } from "./kf-call.mjs";
const P = process.argv[2], publish = process.argv.includes("--publish");
const d = (await kf("GET", `/metadata/2/{acc}/process/${P}/draft`)).json;
writeFileSync(`kf-live/backup-${P}-${Date.now()}.json`, JSON.stringify(d));
const perms = Object.values(d).filter((o) => o && o.Kind === "Permission" && o.Activity && o.Column);
let added = 0;
for (const p of perms) {
  const col = d[p.Column]; if (!col) continue;
  const refs = (col["Column::Permission"] ||= []);
  if (!refs.includes(p.Id)) { refs.push(p.Id); added++; }
}
console.log(`${P}: ${perms.length} step permissions, ${added} back-refs added`);
const put = await kf("PUT", `/metadata/2/{acc}/process/${P}/draft`, d);
console.log("PUT draft", put.status, put.status >= 300 ? JSON.stringify(put.json).slice(0, 200) : "");
if (publish && put.status < 300) { const pub = await kf("POST", `/metadata/2/{acc}/process/${P}/publish`, {}); console.log("publish", pub.status, JSON.stringify(pub.json).slice(0, 200)); }
