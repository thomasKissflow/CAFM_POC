// Read-only: checks every IR permission has its role (original id) as a member of the live flow.
import { readFileSync } from "node:fs";
import { kf } from "./kf-call.mjs";
const APP = "CAFM_POC_A00", q = `?_application_id=${APP}&page_size=200&page_number=1`;
const ir = JSON.parse(readFileSync("app-spec.json", "utf8"));
const map = JSON.parse(readFileSync("kf-live/id-map.json", "utf8")).genToServer;
const known = new Set(Object.values(map));
const roles = (await kf("GET", `/app_role/2/{acc}/list${q}`)).json;
const roleId = {}; for (const r of roles) if (known.has(r._id)) roleId[r.Name] = r._id;
const fam = (t) => (t === "Process" ? "process" : t === "Case" || t === "Board" ? "case" : "form");
const cache = new Map(); let ok = 0; const missing = [];
for (const p of ir.permissions) {
  const f = ir.forms.find((x) => x.name === p.model); const id = map[`${f.name.replace(/[^A-Za-z0-9]+/g, "_")}_A00`];
  if (!id) continue; // not built yet
  if (!cache.has(id)) { const r = await kf("GET", `/flow/2/{acc}/${fam(f.flowType)}/${id}/member${q}`); cache.set(id, Array.isArray(r.json) ? r.json : r.json?.Data ?? []); }
  cache.get(id).some((m) => m._id === roleId[p.role]) ? ok++ : missing.push(`${p.role} → ${p.model}`);
}
console.log(`grants present ${ok}, missing ${missing.length}`); missing.forEach((m) => console.log("  ✗ " + m));
console.log("duplicate roles:", roles.filter((r) => !known.has(r._id) && !["Admin", "User"].includes(r.Name)).map((r) => `${r.Name} ${r._id}`).join(", ") || "none");
