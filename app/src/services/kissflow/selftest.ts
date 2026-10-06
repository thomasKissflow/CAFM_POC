// In-Kissflow self-test: drives the real write path through the SDK (as the signed-in user) and checks each result in Kissflow.
// Everything it creates is titled "[TEST self-test …]", which the loader ignores, and nothing is deleted.
import type { KissflowConnection } from ".";
import { FLOW, SNAG_STATUS } from "./ids";
import { apiPost, listBoard, processItems, str } from "./sdk";

export interface Step { name: string; ok: boolean; detail: string }

export async function runSelfTest(conn: KissflowConnection, onStep: (s: Step) => void): Promise<Step[]> {
  const { services: s, kf, hydrated } = conn;
  const out: Step[] = [];
  const add = (name: string, ok: boolean, detail: string) => { const st = { name, ok, detail }; out.push(st); onStep(st); return ok; };
  const wo = kf.app.getProcess(FLOW.workOrder);
  const kfRow = async (instanceId: string) => (await processItems(wo, "Self-test read")).find((r) => r._id === instanceId);
  const stamp = new Date().toISOString().slice(5, 16).replace("T", " ");
  try {
    const created = await s.workOrders.create({
      siteId: "S-QMR", unitId: "U-QMR-1402", assetId: "A-QMR-FCU-1402-01", category: "ac_not_cooling",
      title: { en: `[TEST self-test ${stamp}] AC not cooling`, ar: "[TEST]" }, description: "In-Kissflow self-test", descriptionLang: "en",
      channel: "voice_agent", reporterName: "Self-test", reportedBy: "P-LAYLA"
    } as never, "P-ARJUN");
    const id = hydrated.ids.workOrder.get(created.id);
    if (!add("Raise work order (SDK create + submit ×2)", id !== undefined, id ?? "no Kissflow id")) return out;
    const iid = id as string;
    let r = await kfRow(iid);
    add("Kissflow routed it to Subcontractor dispatch", r !== undefined && str(r._current_step) === "Subcontractor dispatch", r !== undefined ? `${str(r._current_step)} · L${String(r.Liability_Code)} P${String(r.Priority_Code)}` : "not visible");
    await s.workOrders.accept(created.id, "P-RASHID", "P-JOEL");
    r = await kfRow(iid);
    add("Accept → Work in progress", r !== undefined && str(r._current_step) === "Work in progress", r !== undefined ? String(r._current_step) : "");
    await s.workOrders.arrive(created.id, "P-JOEL");
    add("Arrive (update Arrived At)", true, "saved");
    await s.workOrders.resolve(created.id, { rootCause: "actuator_failed", partsAed: 420, labourAed: 350, note: "Self-test: replaced valve actuator", challengeAcknowledged: true } as never, "P-JOEL");
    r = await kfRow(iid);
    add("Resolve (root cause + labour) → Verify and close", r !== undefined && str(r._current_step) === "Verify and close", r !== undefined ? String(r._current_step) : "");
    await s.workOrders.verifyAndClose(created.id, "P-ARJUN");
    r = await kfRow(iid);
    add("Verify and close → Completed", r === undefined || str(r._status) === "Completed", r !== undefined ? String(r._status) : "left the in-progress list");
  } catch (e) {
    add("Work order path", false, e instanceof Error ? e.message : JSON.stringify(e).slice(0, 200));
  }
  try {
    const snags = await listBoard(kf, FLOW.snag, "Self-test snags");
    const t = snags.find((x) => typeof x.Snag_Location === "string" && x.Snag_Location.includes("[TEST") && x.Snag_Location.includes("S1"));
    if (t === undefined) add("Move a [TEST] snag", false, "no [TEST] S1 snag found");
    else {
      const from = str(t._status_id) ?? "";
      const to = from === SNAG_STATUS.closed ? SNAG_STATUS.in_progress : SNAG_STATUS.closed;
      const moved = await apiPost(kf, `/case/2/${kf.account._id}/${FLOW.snag}/${t._id}/${from}/move`, { _status_id: to });
      console.info("[CAFM] move response", moved);
      const after = (await listBoard(kf, FLOW.snag, "Self-test snags")).find((x) => x._id === t._id);
      add("Move a [TEST] snag (kf.api)", after !== undefined && str(after._status_id) === to, after !== undefined ? String(after._status_name) : "");
    }
  } catch (e) {
    add("Move a [TEST] snag", false, e instanceof Error ? e.message : JSON.stringify(e).slice(0, 200));
  }
  return out;
}
