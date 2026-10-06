// Board tests: create items, move them across statuses, read back. Nothing deleted.
import { kf } from "./kf-call.mjs";
import { rows, Q, sleep } from "./kf-flow.mjs";
const sites = await rows("CAFM_Site_A00"), subs = await rows("CAFM_Subcontractor_A00"), eq = await rows("CAFM_Equipment_A00");
const QMR = sites.find((s) => s.Site_Code === "QMR"), FC = subs.find((s) => s.Company_Name.startsWith("Coolbreeze")), CR = eq.find((e) => e.Fleet_No === "CR-014");
const ST = {
  CAFM_Snag_A00: { "Open": "Status_un5as0", "In progress": "Status_f9bl8q", "Ready for inspection": "Status_1mpphh2", "Carried into DLP": "Status_akywxe", "Closed": "Status_1cv9tq0" },
  CAFM_Breakdown_A00: { "Reported": "Status_1qc60pj", "Diagnosing": "Status_2pvdo5", "Awaiting parts": "Status_t0vwy8", "Under repair": "Status_16m1hw3", "Back in service": "Status_17ei2mj" }
};
async function list(C) { const r = await kf("GET", `/case/2/{acc}/${C}/list${Q}&page_size=200&page_number=1`); return r.status < 300 ? r.json?.Data ?? [] : (console.log("  list", r.status, JSON.stringify(r.json).slice(0, 160)), []); }
// Boards have no Summary field: the test label rides in Snag Location (snags) or is matched on Reported At (breakdowns).
async function item(C, summary, body) {
  const key = C === "CAFM_Snag_A00" ? "Snag_Location" : "Reported_At";
  const b = C === "CAFM_Snag_A00" ? { ...body, Snag_Location: summary } : body;
  const hit = (await list(C)).find((x) => x[key] === b[key]);
  if (hit) return hit._id;
  const r = await kf("POST", `/case/2/{acc}/${C}${Q}`, b);
  if (r.status >= 300) throw new Error(`create ${C} ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  return r.json._id;
}
// Move = POST /case/2/{acc}/{board}/{item}/{CURRENT status}/move  { _status_id: <target> }  (verified live 22 Sep)
async function move(C, id, to) {
  const cur = (await list(C)).find((x) => x._id === id);
  if (cur?._status_name === to) return `${to} (already)`;
  const r = await kf("POST", `/case/2/{acc}/${C}/${id}/${cur._status_id}/move${Q}`, { _status_id: ST[C][to] });
  await sleep(800); return r.status < 300 ? to : `✗ ${r.status} ${JSON.stringify(r.json).slice(0, 140)}`;
}
async function status(C, id) { return (await list(C)).find((x) => x._id === id)?._status_name ?? "?"; }
const TAG = process.env.RUN_TAG ? ` ${process.env.RUN_TAG}` : "";
const runs = [
  ["CAFM_Snag_A00", `[TEST${TAG}] S1 Paint touch-up, Apt 1402 corridor`, { Site: { _id: QMR._id }, Trade: "Finishes", Snag_Location: "Level 14 corridor" }, ["In progress", "Ready for inspection", "Closed"]],
  ["CAFM_Snag_A00", `[TEST${TAG}] S2 FCU drain slope, Apt 1305`, { Site: { _id: QMR._id }, Trade: "HVAC", Subcontractor: { _id: FC._id }, Snag_Location: "Apt 1305 living room" }, ["In progress", "Carried into DLP"]],
  ["CAFM_Breakdown_A00", `[TEST${TAG}] BD1 CR-014 slew brake fault`, { Equipment: { _id: CR._id }, Reported_At: TAG ? new Date().toISOString().replace(/\.\d+Z$/, "Z") : "2026-09-20T06:30:00Z", Downtime_Hours: 26, Repair_Cost_AED: 4800 }, ["Diagnosing", "Awaiting parts", "Under repair", "Back in service"]]
];
for (const [C, summary, body, path] of runs) {
  const id = await item(C, summary, body);
  const moves = [];
  for (const to of path) moves.push(await move(C, id, to));
  const final = await status(C, id);
  const ok = moves.every((m) => !m.startsWith("✗"));
  console.log(`${ok ? "✓" : "✗"} ${summary} → ${moves.join(" → ")} · read back: ${final}`);
}
