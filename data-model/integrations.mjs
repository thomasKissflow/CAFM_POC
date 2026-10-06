// Phase 4 step 9: integrations (one trigger → one action each), created + published, INACTIVE.
// Uses the engine's applyIntegrationResolved; the engine catalog has no Dataform entry, so it is added here
// from the live connector metadata (Kissflow Dataform 1.5.4: CreateAndSubmitItem / UpdateAnItem).
// Idempotent by name. Turning on is a builder action (Integration-Admin).
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "./kf-call.mjs";
const ENGINE = `${process.env.HOME}/.claude/plugins/cache/kissflow/app-agents/1.6.0/engine`;
const I = await import("./vendor/integrations.mjs");
const { clientFromEnv } = await import(`${ENGINE}/client.mjs`);
loadEnv();
const APP = "CAFM_POC_A00";
const base = clientFromEnv();
const c = { ...base, call: (m, p, ...r) => base.call(m, m === "GET" && /\/(list|explore|subscription|integration)(\?|$)/.test(p) && !/page_size=/.test(p) ? p + (p.includes("?") ? "&" : "?") + "page_size=200&page_number=1" : p, ...r) };
const acc = c.acc;

// catalog additions (live-verified ids from GET /connector/2/{acc}/{id}/metadata/{version}, 22 Sep)
I.CONNECTOR_CATALOG.dataform = { match: /kissflow dataform/i, triggers: { created: "ItemCreated", updated: "ItemUpdated" }, actions: { createSubmit: "CreateAndSubmitItem", update: "UpdateAnItem" } };
Object.assign(I.CONNECTOR_CATALOG.process.triggers, { advances: "ItemAdvancesToNextStep", slaBreached: "SlaBreached" });
Object.assign(I.EVENT_TO_TRIGGER, { advanced: "advances", sla_breached: "slaBreached" });

const ir = JSON.parse(readFileSync("app-spec.json", "utf8"));
const map = JSON.parse(readFileSync("kf-live/id-map.json", "utf8")).genToServer;
const slug = (n) => n.replace(/[^A-Za-z0-9]+/g, "_");
const SYS = ["_id", "_current_step", "_created_at", "_modified_at", "_completed_at", "_status"].map((id) => ({ id, name: id, type: "Text" }));
const flows = {};
for (const f of ir.forms) {
  const id = map[`${slug(f.name)}_A00`]; if (!id) continue;
  flows[f.name] = { id, display: f.name, fields: [...f.fields.map((x) => ({ id: slug(x.name), name: x.name, type: x.type })), ...SYS] };
}
const flowTypeOf = (ref) => ir.forms.find((x) => x.name === ref)?.flowType || "Process";
const connectors = await I.resolveConnectors(c, acc);
console.log("connectors:", Object.keys(connectors).join(", "));

const WO = "CAFM Work Order", EV = "CAFM WO Event", REG = "CAFM WO Register", BC = "CAFM Back-charge";
const A = [
  { name: "WO created → add 'Created' to the WO activity log", source: { flow: WO, event: "created" }, action: { type: "create", target_flow: EV,
    field_map: { "Work Order No": "_id", "Work Order Instance": "_id", "Event Type": '"Created"', "Event At": "_created_at", "Actor Label": "Reporter Name", "Event Detail": "Request Title" } } },
  { name: "WO moves to next step → add 'Step changed' to the WO activity log", source: { flow: WO, event: "advanced" }, action: { type: "create", target_flow: EV,
    field_map: { "Work Order No": "_id", "Work Order Instance": "_id", "Event Type": '"Step changed"', "Event At": "_modified_at", "Event Detail": "_current_step" } } },
  { name: "WO misses its deadline → add 'SLA breach' to the WO activity log", source: { flow: WO, event: "sla_breached" }, action: { type: "create", target_flow: EV,
    field_map: { "Work Order No": "_id", "Work Order Instance": "_id", "Event Type": '"SLA breach"', "Event At": "_modified_at", "Event Detail": "_current_step" } } },
  { name: "WO misses its deadline → email the FM manager", source: { flow: WO, event: "sla_breached" }, action: { type: "notify", target_flow: WO } },
  { name: "WO closed (DLP) → raise a Back-charge to the installing subcontractor", source: { flow: WO, event: "completed" }, action: { type: "create", target_flow: BC,
    field_map: { "Work Order No": "_id", "Work Order Instance": "_id", Subcontractor: "Installed By", Site: "Site", "Root Cause": "Root Cause", "Parts AED": "Parts AED", "Labour AED": "Labour AED" } } },
  { name: "WO closed → add a row to the WO Register (history)", source: { flow: WO, event: "completed" }, action: { type: "create", target_flow: REG,
    field_map: { "Work Order No": "_id", "Work Order Instance": "_id", Site: "Site", "Asset Tag": "Asset Tag", Batch: "Batch", Channel: "Channel", "Summer Uplift": "Summer Uplift",
      "Priority Code": "Priority Code", "Liability Code": "Liability Code", "First Contact At": "First Contact At", "Current Step": "_current_step", "Closed At": "_completed_at",
      "Technician": "Assigned Technician", "Parts AED": "Parts AED", "Labour AED": "Labour AED", "Back-charge Ref": "Back-charge Ref" } } },
  { name: "Back-charge recovered → add 'Back-charge recovered' to the WO activity log", source: { flow: BC, event: "completed" }, action: { type: "create", target_flow: EV,
    field_map: { "Work Order No": "Work Order No", "Work Order Instance": "Work Order Instance", "Event Type": '"Back-charge recovered"', "Event At": "_completed_at", "Event Detail": "Agreed AED" } } }
];
const existing = await c.call("GET", `/flow/2/${acc}/integration?_application_id=${APP}`);
const byName = new Map((Array.isArray(existing.body) ? existing.body : existing.body?.Data || []).map((i) => [i.Name, i._id]));
const out = [];
for (const a of A) {
  const remap = process.argv.includes("--remap") && byName.has(a.name) && a.action.type !== "notify";
  if (byName.has(a.name) && !remap) { console.log(`= ${a.name} (exists ${byName.get(a.name)})`); out.push({ name: a.name, id: byName.get(a.name), status: "exists" }); continue; }
  const rep = await I.applyIntegrationResolved(c, acc, APP, a, { flows, connectors, flowTypeOf, existingId: remap ? byName.get(a.name) : undefined });
  const ok = (rep.steps?.publish ?? 500) < 300;
  console.log(`${ok ? "+" : "✗"} ${a.name} → ${rep.id ?? "?"} ${JSON.stringify(rep.steps)}${rep.unresolved ? " · unresolved: " + rep.unresolved.join(", ") : ""}${rep.error ? " · " + rep.error : ""}${rep.putBody ? " · " + rep.putBody : ""}`);
  out.push({ name: a.name, id: rep.id, ok, steps: rep.steps, unresolved: rep.unresolved });
}
writeFileSync("kf-live/integrations-report.json", JSON.stringify(out, null, 1));
