// Sequential re-grant for member grants that hit 423 (locked) during apply's parallel grant loop.
// Mirrors the engine's three legs (flow member, report View, formview Viewer), one call at a time with backoff.
// usage: node regrant.mjs kf-live/report-A.json
import { readFileSync } from "node:fs";
import { kf } from "./kf-call.mjs";
const ENGINE = `${process.env.HOME}/.claude/plugins/cache/kissflow/app-agents/1.6.0/engine`;
const { flowGrant } = await import(`${ENGINE}/client.mjs`);
const APP = "CAFM_POC_A00";
const rep = JSON.parse(readFileSync(process.argv[2], "utf8"));
const ir = JSON.parse(readFileSync("app-spec.json", "utf8"));
const map = JSON.parse(readFileSync("kf-live/id-map.json", "utf8")).genToServer;
const roles = (await kf("GET", `/app_role/2/{acc}/list?_application_id=${APP}&page_size=200&page_number=1`)).json;
// Prefer the role ids recorded in the build's id map (the originals) over any same-named duplicates.
const known = new Set(Object.values(map));
const roleId = {};
for (const r of Array.isArray(roles) ? roles : roles.Data ?? []) if (known.has(r._id) || roleId[r.Name] === undefined) roleId[r.Name] = known.has(r._id) ? r._id : roleId[r.Name] ?? r._id;
for (const r of Array.isArray(roles) ? roles : roles.Data ?? []) if (known.has(r._id)) roleId[r.Name] = r._id;
const onlyRole = process.argv[3];
const failed = onlyRole ? ir.permissions.filter((p) => p.role === onlyRole && rep.members.some((m) => m.model === p.model)).map((p) => ({ role: p.role, model: p.model })) : rep.members.filter((m) => m.status >= 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(path, body) {
  for (let i = 0; i < 6; i++) { const r = await kf("POST", path, body); if (r.status !== 423) return r; await sleep(1500 * (i + 1)); }
  return { status: 423 };
}
let ok = 0, bad = 0;
for (const m of failed) {
  const perm = ir.permissions.find((p) => p.role === m.role && p.model === m.model);
  const fSpec = ir.forms.find((f) => f.name === m.model);
  const serverFlow = map[`${fSpec.name.replace(/[^A-Za-z0-9]+/g, "_")}_A00`];
  const g = flowGrant(fSpec.flowType || "Form", { editable: (perm.level || "Editable") !== "ReadOnly", admin: /admin|owner|sole mover|coordinat/i.test(perm.intent || "") });
  const q = `?_application_id=${APP}`;
  const member = { _id: roleId[m.role], Name: m.role, _application_id: APP, Role: g.role, Permission: g.permission, Kind: "AppRole" };
  const r = await post(`/flow/2/{acc}/${g.family}/${serverFlow}/member/batch${q}`, [member]);
  const reports = (await kf("GET", `/flow/2/{acc}/${g.family}/${serverFlow}/report${q}`)).json;
  for (const rp of Array.isArray(reports) ? reports : []) await post(`/flow/2/{acc}/${g.family}/${serverFlow}/report/${rp._id}/member/batch${q}`, [{ _id: roleId[m.role], Name: m.role, _application_id: APP, Role: "Member", Permission: ["View"], Kind: "AppRole" }]);
  if (g.family === "form") {
    const fvs = (await kf("GET", `/flow/2/{acc}/form/${serverFlow}/formview/${q}`)).json;
    for (const fv of Array.isArray(fvs) ? fvs : []) await post(`/flow/2/{acc}/form/${serverFlow}/formview/${fv._id}/member/batch${q}`, [{ _id: roleId[m.role], Name: m.role, _application_id: APP, Role: "Viewer", Permission: [], Kind: "AppRole" }]);
  }
  console.log(`${r.status < 300 ? "✓" : "✗"} ${m.role} → ${m.model} ${r.status}`);
  r.status < 300 ? ok++ : bad++;
  await sleep(400);
}
console.log(`re-granted ${ok}, still failing ${bad}`);
