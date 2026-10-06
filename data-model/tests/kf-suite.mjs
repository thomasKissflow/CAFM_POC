// Phase 5: repeatable Kissflow backend suite for CAFM_POC_A00.
//   node tests/kf-suite.mjs            → structure, access, integrations, seed, adapter contract, step permissions, formulas (on live seeded work orders)
//   node tests/kf-suite.mjs --scenarios → also drives [TEST] items through every route (idempotent by title; rejects, never deletes)
// Exit code 1 if any check fails. Results → tests/last-run.json
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
import { kf } from "../kf-call.mjs";
const APP = "CAFM_POC_A00", Q = `?_application_id=${APP}`;
const ir = JSON.parse(readFileSync(new URL("../app-spec.json", import.meta.url), "utf8"));
const { RENAMES } = await import("../renames.mjs");
const results = [];
const check = (area, name, ok, detail = "") => { results.push({ area, name, ok: !!ok, detail }); console.log(`${ok ? "✓" : "✗"} [${area}] ${name}${detail ? " — " + detail : ""}`); };
const slug = (n) => n.replace(/[^A-Za-z0-9]+/g, "_");
async function allRows(form) { const out = []; for (let p = 1; ; p++) { const d = (await kf("POST", `/form/2/{acc}/${form}/allitems/list${Q}&page_size=1000&page_number=${p}`, {})).json?.Data ?? []; out.push(...d); if (d.length < 1000) break; } return out; }
const caseRows = async (C) => (await kf("GET", `/case/2/{acc}/${C}/list${Q}&page_size=1000&page_number=1`)).json?.Data ?? [];
const FAM = { Process: "process", Case: "case", Form: "form" };
const topForms = ir.forms.filter((f) => !ir.childTables.some((c) => c.child === f.name));

// ---------- 1. structure ----------
for (const f of topForms) {
  const id = `${slug(f.name)}_A00`, fam = FAM[f.flowType] ?? "form";
  const g = await kf("GET", `/flow/2/{acc}/${fam}/${id}${Q}`);
  const want = RENAMES[fam]?.[id];
  check("structure", `${f.name} is live${want ? ` as "${want}"` : ""}`, g.status === 200 && g.json?.Status === "Live" && (!want || g.json?.Name === want), `${g.status} ${g.json?.Status ?? ""} "${g.json?.Name ?? ""}"`);
}
const lists = await Promise.all(ir.lists.map(async (l) => [l, (await kf("GET", `/flow/2/{acc}/list/${slug(l.name)}_A00/items?page_size=200&page_number=1`)).json]));
for (const [l, items] of lists) check("structure", `list ${l.name}`, Array.isArray(items) && l.items.every((i) => items.includes(i)), Array.isArray(items) ? `${items.length} items` : "unreadable");
const roles = (await kf("GET", `/app_role/2/{acc}/list${Q}&page_size=200&page_number=1`)).json;
const names = roles.map((r) => r.Name);
check("structure", "10 app roles, no duplicates", ir.roles.every((r) => names.filter((n) => n === (r.name ?? r)).length === 1), names.join(", "));

// ---------- 2. access (flow membership per role; runtime visibility needs real users per role, see BACKEND_CATALOG) ----------
try { const out = execFileSync("node", ["audit-grants.mjs"], { cwd: ROOT }).toString(); const m = /grants present (\d+), missing (\d+)/.exec(out); check("access", "every IR grant present on the live flow", m && m[2] === "0", m ? `${m[1]} present, ${m[2]} missing` : out.slice(0, 120)); }
catch (e) { check("access", "grant audit ran", false, String(e.message).slice(0, 120)); }
const woMembers = (await kf("GET", `/flow/2/{acc}/process/CAFM_Work_Order_A00/member${Q}&page_size=200&page_number=1`)).json;
check("access", "Resident can raise work orders", (Array.isArray(woMembers) ? woMembers : []).some((m) => m.Name === "Resident" && (m.Permission ?? []).includes("InitiateItems")));
check("access", "Executive is view-only on work orders", (Array.isArray(woMembers) ? woMembers : []).some((m) => m.Name === "Executive" && !(m.Permission ?? []).includes("InitiateItems")));

// Regression guard: a role silently became DataAdmin (sees and edits every item) on the Work Order once (22 Sep).
for (const f of topForms) {
  const id = `${slug(f.name)}_A00`, fam = FAM[f.flowType] ?? "form";
  const m = (await kf("GET", `/flow/2/{acc}/${fam}/${id}/member${Q}&page_size=200&page_number=1`)).json;
  const admins = (Array.isArray(m) ? m : m?.Data ?? []).filter((x) => x.Kind === "AppRole" && x.Role === "DataAdmin").map((x) => x.Name);
  if (admins.length || f.flowType === "Process") check("access", `${f.name}: no role has DataAdmin`, !admins.length, admins.join(", "));
}

// ---------- 3. step field permissions (Column::Permission back-refs, Q42) ----------
for (const P of ["CAFM_Work_Order_A00", "CAFM_Back_charge_A00", "CAFM_Permit_To_Work_A00"]) {
  const d = (await kf("GET", `/metadata/2/{acc}/process/${P}/draft`)).json;
  const perms = Object.values(d).filter((o) => o && o.Kind === "Permission" && o.Activity);
  const linked = perms.filter((p) => (d[p.Column]?.["Column::Permission"] ?? []).includes(p.Id)).length;
  check("permissions", `${P}: step permissions linked to their fields`, linked === perms.length, `${linked}/${perms.length} linked`);
}

// ---------- 4. integrations ----------
const ints = (await kf("GET", `/flow/2/{acc}/integration${Q}&page_size=200&page_number=1`)).json;
const intList = Array.isArray(ints) ? ints : ints?.Data ?? [];
for (const want of JSON.parse(readFileSync(new URL("../kf-live/integrations-report.json", import.meta.url), "utf8"))) {
  const it = intList.find((i) => i._id === want.id);
  if (!it) { check("integrations", want.name, false, "missing"); continue; }
  const d = (await kf("GET", `/metadata/2/{acc}/integration/${want.id}/draft`)).json;
  const bound = Object.values(d).filter((o) => o && o.Kind === "Property").length;
  check("integrations", `${want.name}`, bound > 1 || /email/.test(want.name), `${bound} bindings · ${it.IsActive ? "ON" : "off (switch on in builder)"}`);
}

// ---------- 5. seed matches the demo generator ----------
const { db } = JSON.parse(readFileSync(new URL("../seed/mock-db.json", import.meta.url), "utf8"));
// The app is seeded with the small world (one building) since 23 Sep; --full checks a full seed instead.
if (!process.argv.includes("--full")) { const { applyMinimal } = await import("../seed/minimal.mjs"); applyMinimal(db); }
const seedChecks = [
  ["CAFM_Site_A00", db.sites.length, (r) => r.Site_Code], ["CAFM_Subcontractor_A00", db.subcontractors.length, (r) => r.Company_Name],
  ["CAFM_Unit_A00", db.units.length, (r) => `${r.Site?._id}|${r.Unit_Number}`], ["CAFM_Asset_A00", db.assets.length, (r) => r.QR_Code],
  ["CAFM_WO_Register_A00", db.workOrders.filter((w) => w.status === "closed").length, (r) => r.Work_Order_No],
  ["CAFM_Compliance_Certificate_A00", db.compliance.length, (r) => r.Certificate_No], ["CAFM_PPM_Schedule_A00", db.ppm.length, (r) => r.Schedule_Title],
  ["CAFM_Equipment_A00", db.equipment.length, (r) => r.Fleet_No]
];
for (const [form, n, key] of seedChecks) {
  const rows = await allRows(form); const keys = rows.map(key).filter((k) => k && k !== "undefined");
  const uniq = new Set(keys).size;
  check("seed", `${form}: all ${n} demo records, no duplicates`, uniq >= n && uniq === keys.length, `${rows.length} rows, ${uniq} unique keys`);
}
const snags = await caseRows("CAFM_Snag_A00");
const demoSnag = {}; for (const s of db.snags) demoSnag[s.status] = (demoSnag[s.status] ?? 0) + 1;
const snagSeeded = snags.filter((s) => /^SNG-/.test(s.Snag_Location ?? ""));
const got = {}; for (const s of snagSeeded) got[s._status_name] = (got[s._status_name] ?? 0) + 1;
check("seed", `snags: ${db.snags.length} with the demo's status mix`, snagSeeded.length === db.snags.length && got["Closed"] === demoSnag.closed && got["Carried into DLP"] === demoSnag.carried_to_dlp, JSON.stringify(got));
const reg = await allRows("CAFM_WO_Register_A00");
const dlp = reg.filter((r) => r.Liability_Code === 1).length;
check("seed", "history: DLP jobs = demo back-charges", dlp === db.backCharges.length, `${dlp} DLP rows vs ${db.backCharges.length} back-charges`);
check("seed", "history: Total Cost formula computed", reg.filter((r) => r.Parts_AED != null).every((r) => r.Total_Cost_AED === (r.Parts_AED ?? 0) + (r.Labour_AED ?? 0)));

// ---------- 6. adapter contract (fields the Phase 6 Custom UI adapter reads/writes) ----------
const CONTRACT = {
  CAFM_Work_Order_A00: ["Site", "Unit", "Category", "Asset", "Request_Title", "Description", "Channel", "Reporter_Name", "First_Contact_At", "Conversation_Transcript", "Vulnerable_Occupant", "Access_Window",
    "Own_Operations", "Base_Priority", "Summer_Uplift", "Structural", "DLP_End_Date", "Warranty_End_Date", "Priority_Code", "Response_Minutes", "Resolve_Minutes", "Liability_Code", "Dispatch_Code",
    "Root_Cause", "Labour_AED", "Parts_AED", "Closeout_Note", "Occupant_Signature", "Resolved_At", "Verified_At"],
  CAFM_Back_charge_A00: ["Work_Order_No", "Subcontractor", "Parts_AED", "Labour_AED", "Total_AED", "Subcontractor_Response", "Dispute_Reason", "Agreed_AED", "Recovered_On"],
  CAFM_Asset_A00: ["Asset_Tag", "QR_Code", "Site", "Unit", "Asset_Class", "Installed_By", "Batch", "DLP_End_Date", "Warranty_End_Date", "Decennial_End_Date"],
  CAFM_WO_Register_A00: ["Work_Order_No", "Site", "Category_Name", "Channel", "Priority_Code", "Liability_Code", "First_Contact_At", "Closed_At", "Parts_AED", "Labour_AED", "Total_Cost_AED", "Back_charge_Status"]
};
for (const [flow, fields] of Object.entries(CONTRACT)) {
  const fam = /Order_A00|charge_A00/.test(flow) ? "process" : "form";
  const d = (await kf("GET", `/metadata/2/{acc}/${fam}/${flow}/draft`)).json;
  const have = new Set(Object.values(d).filter((o) => o && o.Kind === "Field").map((o) => o.Id));
  const missing = fields.filter((f) => !have.has(f));
  check("contract", `${flow}: ${fields.length} adapter fields exist`, !missing.length, missing.length ? `missing ${missing.join(", ")}` : "");
}

// ---------- 7. formulas on the live seeded work orders (the sandbox dataforms were deleted 22 Sep) ----------
{
  const L = { DLP: 1, CHARGEABLE: 2, DECENNIAL_REVIEW: 3, WARRANTY: 4, OWN_OPS: 5 }, PC = { P1: 1, P2: 2, P3: 3, P4: 4 };
  const r = await kf("POST", `/process/2/{acc}/CAFM_Work_Order_A00/myitems/inprogress?apply_preference=false&page_number=1&page_size=500&_application_id=${APP}`, { Columns: [{ Id: "Request_Title" }, { Id: "Priority_Code" }, { Id: "Liability_Code" }, { Id: "Dispatch_Code" }, { Id: "Response_Minutes" }] });
  const live = r.json?.Data ?? [];
  for (const w of db.workOrders.filter((x) => x.status !== "closed")) {
    const it = live.find((x) => x.Request_Title === `${w.ref} · ${w.title.en}`);
    check("formulas", `${w.ref}: priority + liability computed by Kissflow match the demo`, it && it.Liability_Code === L[w.liability] && it.Priority_Code === PC[w.priority], it ? `L${it.Liability_Code} P${it.Priority_Code} D${it.Dispatch_Code} ${it.Response_Minutes}m` : "not found");
  }
}

// ---------- 8. scenarios (optional) ----------
if (process.argv.includes("--scenarios")) {
  const RUN_TAG = `r${new Date().toISOString().slice(5, 16).replace(/[-:T]/g, "")}`; // fresh items every run
  console.log(`scenarios tagged [TEST ${RUN_TAG}]`);
  for (const [script, re] of [["test-wo.mjs", /^(✓|✗) (W\d+)/], ["test-boards.mjs", /^(✓|✗) \[TEST[^\]]*\] (\S+)/]]) {
    try { const out = execFileSync("node", [script], { cwd: ROOT, env: { ...process.env, RUN_TAG } }).toString(); for (const line of out.split("\n")) { const m = re.exec(line); if (m) check("scenarios", `${script} ${m[2]}`, m[1] === "✓", line.slice(2, 140)); } }
    catch (e) { check("scenarios", script, false, String(e.stdout ?? e.message).slice(-200)); }
  }
}

const failed = results.filter((r) => !r.ok);
writeFileSync(new URL("./last-run.json", import.meta.url), JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 1));
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? ` · ${failed.length} failed` : ""}`);
process.exit(failed.length ? 1 : 0);
