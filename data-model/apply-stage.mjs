// Phase 4 staged build into the EXISTING app CAFM_POC_A00 (never creates a new app).
//   node apply-stage.mjs A   → roles + lists + dataforms + "CAFM zz Formula Sandbox" (all editable after publish)
//   node apply-stage.mjs B   → everything (processes, boards, child tables, permissions), reusing stage A ids
// Custom-UI mode: no native pages or nav (pageMode "none").
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "./kf-call.mjs";
const ENGINE = `${process.env.HOME}/.claude/plugins/cache/kissflow/app-agents/1.6.0/engine`;
const { applyIR, clientFromEnv } = await import(`${ENGINE}/client.mjs`);
const { normalizeIR } = await import(`${ENGINE}/builders.mjs`);
const { validateIR } = await import(`${ENGINE}/ir.mjs`);
const { loadRunSpec } = await import(`${ENGINE}/ir.mjs`);

loadEnv();
process.env.KF_AI_PAGES = "0";
const stage = process.argv[2];
if (!["A", "B", "C"].includes(stage)) { console.error("usage: node apply-stage.mjs A|B|C"); process.exit(2); }
const dir = "kf-live";
mkdirSync(dir, { recursive: true });
const full = JSON.parse(readFileSync("app-spec.json", "utf8"));
const APP = "CAFM_POC_A00";
if (full.app.id !== APP) throw new Error(`IR app id ${full.app.id} is not ${APP}`);

/** Sandbox = the Work Order's formula fields plus every field they read, copied verbatim. */
function sandboxForm() {
  const wo = full.forms.find((f) => f.name === "CAFM Work Order");
  const byKey = new Map(wo.fields.map((f) => [f.name.replace(/[^A-Za-z0-9]+/g, "_"), f]));
  const need = new Set();
  const visit = (f) => {
    if (need.has(f.name)) return;
    need.add(f.name);
    for (const m of (f.formula ?? "").matchAll(/\b[A-Z][A-Za-z0-9_]*\b/g)) { const dep = byKey.get(m[0]); if (dep) visit(dep); }
  };
  wo.fields.filter((f) => f.formula && f.section === "Triage").forEach(visit);
  const fields = wo.fields.filter((f) => need.has(f.name)).map(({ section, required, ...f }) => ({ ...f, section: f.formula ? "Computed" : "Inputs" }));
  const asset = wo.fields.find((f) => f.name === "Asset");
  const category = wo.fields.find((f) => f.name === "Category");
  fields.unshift({ name: "Test Case", type: "Text", required: true, section: "Inputs" }, { ...asset, section: "Inputs" }, { ...category, required: false, section: "Inputs" });
  // Category autofills Category Name (not otherwise in the sandbox) — include the copy target so the lookup has somewhere to land.
  for (const n of ["Asset Tag", "Batch", "Decennial End Date"]) { const src = wo.fields.find((f) => f.name === n); if (src && !fields.some((f) => f.name === n)) fields.push({ ...src, section: "Inputs" }); }
  // Money is Number (AED): same shape as WO Parts "Line Total AED" = Qty * Unit_Cost_AED.
  fields.push({ name: "C Qty", type: "Number", section: "Inputs" }, { name: "C Unit Num", type: "Number", section: "Inputs" },
    { name: "C Num Line", type: "Number", section: "Variants", formula: "C_Qty * C_Unit_Num" });
  // Same shape as the Subcontractor / Compliance expiry countdown, on DLP End Date (signed days from today).
  fields.push({ name: "E Days Signed", type: "Number", section: "Variants", formula: "IF(ABS(YEAR(DLP_End_Date) * 372 + MONTH(DLP_End_Date) * 31 + DAY(DLP_End_Date) - (YEAR(TODAY()) * 372 + MONTH(TODAY()) * 31 + DAY(TODAY()))) = YEAR(DLP_End_Date) * 372 + MONTH(DLP_End_Date) * 31 + DAY(DLP_End_Date) - (YEAR(TODAY()) * 372 + MONTH(TODAY()) * 31 + DAY(TODAY())), DATEDIFF(TODAY(), DLP_End_Date, \"Day\"), 0 - DATEDIFF(TODAY(), DLP_End_Date, \"Day\"))" });
  return { name: process.env.SANDBOX_NAME ?? "CAFM zz Formula Sandbox", flowType: "Form", fields };
}

let ir;
if (stage === "A") {
  const processChildren = new Set(full.childTables.filter((c) => !full.forms.find((f) => f.name === c.parent && f.flowType === "Form")).map((c) => c.child));
  const forms = full.forms.filter((f) => f.flowType === "Form" && !processChildren.has(f.name));
  forms.push(sandboxForm());
  const names = new Set(forms.map((f) => f.name));
  ir = {
    ...full,
    forms,
    childTables: full.childTables.filter((c) => names.has(c.parent)),
    permissions: [...full.permissions.filter((p) => names.has(p.model)), { role: "Admin", model: "CAFM zz Formula Sandbox", level: "Editable", scope: "all" }].filter((p) => p.role !== "Admin" || full.roles.some((r) => (r.name ?? r) === "Admin"))
  };
} else if (stage === "C") {
  // Phase 7: only the AI dataforms (nothing else is touched)
  const only = new Set(["CAFM AI Conversation", "CAFM AI Setting"]);
  ir = { ...full, forms: full.forms.filter((f) => only.has(f.name)), childTables: [], permissions: full.permissions.filter((p) => only.has(p.model)) };
} else {
  ir = full;
}
ir = normalizeIR(ir);
const v = validateIR(ir);
const errs = v.issues.filter((i) => i.level === "error" && !["NO_WORKFLOW"].includes(i.code));
console.log(`stage ${stage}: ${ir.forms.length} forms, ${ir.lists.length} lists, ${ir.roles.length} roles, ${ir.permissions.length} permissions`);
if (errs.length) { errs.forEach((e) => console.log(`  ✗ [${e.code}] ${e.msg} (${e.where})`)); process.exit(1); }
if (process.argv.includes("--check")) process.exit(0);

const idMapFile = join(dir, "id-map.json");
const prior = existsSync(idMapFile) ? JSON.parse(readFileSync(idMapFile, "utf8")) : { app: APP, genToServer: {} };
if (prior.app !== APP) throw new Error(`id-map points at ${prior.app}, expected ${APP}`);
// Engine list calls default to 10 per page: with 11+ roles the role lookup misses one and creates a
// duplicate (found live, 22 Sep: a second "Technician"). Force a full page on every list/explore read.
const base = clientFromEnv();
const client = { ...base, call: (method, path, ...rest) => {
  if (method === "GET" && /\/(list|explore|member|report)(\?|$|\/?\?)/.test(path) && !/page_size=/.test(path)) path += (path.includes("?") ? "&" : "?") + "page_size=200&page_number=1";
  return base.call(method, path, ...rest);
} };
const rep = await applyIR(ir, { client, stateFile: join(dir, "apply-state.json"), aiPages: false, pageMode: "none", reuse: { appId: APP, genToServer: prior.genToServer || {} }, prodFirst: false });
writeFileSync(join(dir, `report-${stage}.json`), JSON.stringify(rep, null, 1));
console.log(`app ${rep.app} · created ${rep.created.length} · published ${rep.published.length} · skipped ${rep.skipped?.length ?? 0}`);
console.log(`roles: ${rep.roles.map((r) => `${r.name}(${r.status})`).join(", ")}`);
if (rep.errors.length) { console.log("errors:"); rep.errors.forEach((e) => console.log("  ✗ " + e)); process.exit(1); }

// Display names (Q43): the IR keeps technical names so gen ids stay stable; re-apply the plain names after every build.
const { RENAMES, PREFIX } = await import("./renames.mjs");
const { kf } = await import("./kf-call.mjs");
for (const [type, m] of Object.entries(RENAMES)) for (const [id, name] of Object.entries(m))
  if (rep.published?.includes?.(id) || rep.created?.some?.((x) => JSON.stringify(x).includes(id))) await kf("PUT", `/flow/2/{acc}/${type}/${id}?_application_id=${APP}`, { Name: name, ...(PREFIX[id] ? { Prefix: PREFIX[id] } : {}) });
console.log("display names re-applied");
