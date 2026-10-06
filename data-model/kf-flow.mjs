// Helpers for driving live process / board items (Phase 4 tests). Nothing here deletes.
import { kf } from "./kf-call.mjs";
export const Q = "?_application_id=CAFM_POC_A00";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function rows(form) { return (await kf("POST", `/form/2/{acc}/${form}/allitems/list${Q}&page_size=200&page_number=1`, {})).json.Data ?? []; }
/** Current state of a process item: step, the activity instance to act on, assignees, all fields. */
export async function state(P, id) {
  for (const view of ["draft", "inprogress", "completed", "rejected", "withdrawn"]) {
    const l = await kf("POST", `/process/2/{acc}/${P}/myitems/${view}?apply_preference=false&page_number=1&page_size=200&_application_id=CAFM_POC_A00`, {});
    const row = (l.json?.Data ?? []).find((x) => x._id === id);
    if (!row) continue;
    const d = (await kf("GET", `/process/2/{acc}/${P}/${id}/${row._activity_instance_id}${Q}&_response_type=full`)).json;
    const ctx = d._current_context?.[0];
    // the listed activity can be an earlier step: re-read through the current one so fields are up to date
    const cur = ctx?._context_activity_instance_id;
    if (cur && cur !== row._activity_instance_id) {
      const d2 = (await kf("GET", `/process/2/{acc}/${P}/${id}/${cur}${Q}&_response_type=full`)).json;
      if (d2 && d2._id) Object.assign(d, d2);
    }
    return { view, step: d._current_step ?? row._current_step, status: d._status, aiid: ctx?._context_activity_instance_id ?? row._activity_instance_id, assigned: (ctx?._context_assigned_to ?? d._current_assigned_to ?? []).map((a) => a.Name), item: d };
  }
  return { view: "not found" };
}
/** Find an existing item by title across views (so a re-run reuses instead of duplicating). */
export async function findByTitle(P, field, title, views = ["draft", "inprogress", "completed", "rejected", "withdrawn"]) {
  for (const view of views) {
    const l = await kf("POST", `/process/2/{acc}/${P}/myitems/${view}?apply_preference=false&page_number=1&page_size=200&_application_id=CAFM_POC_A00`, { Columns: [{ Id: field }] });
    const row = (l.json?.Data ?? []).find((x) => x[field] === title);
    if (row) return row._id;
  }
  return null;
}
export async function create(P, body, titleField, views) {
  if (titleField) { const hit = await findByTitle(P, titleField, body[titleField], views); if (hit) return hit; }
  const c = await kf("POST", `/process/2/{acc}/${P}${Q}`, body);
  if (c.status >= 300) throw new Error(`create ${P} ${c.status} ${JSON.stringify(c.json).slice(0, 300)}`);
  return c.json._id;
}
export async function update(P, id, aiid, fields) {
  const r = await kf("POST", `/process/2/{acc}/${P}/${id}/${aiid}${Q}`, fields); // POST = update item at this step (step field permissions apply)
  if (r.status >= 300) console.log(`    ! update ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  return r.status;
}
export async function submit(P, id, fields) {
  const s = await state(P, id);
  if (fields && (await update(P, id, s.aiid, fields)) >= 300) { console.log(`    ! not submitting ${s.step}: update failed`); return s; }
  const r = await kf("POST", `/process/2/{acc}/${P}/${id}/${s.aiid}/submit${Q}`, {});
  if (r.status >= 300) console.log(`    ! submit at ${s.step} ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  await sleep(1500);
  return state(P, id);
}
export async function reject(P, id, note) {
  const s = await state(P, id);
  const r = await kf("POST", `/process/2/{acc}/${P}/${id}/${s.aiid}/reject${Q}`, { Note: note });
  if (r.status >= 300) console.log(`    ! reject at ${s.step} ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  await sleep(1500);
  return state(P, id);
}
export const fmt = (s) => `${s.step ?? "?"} [${s.status ?? s.view}]${s.assigned?.length ? " → " + s.assigned.join(", ") : ""}`;
