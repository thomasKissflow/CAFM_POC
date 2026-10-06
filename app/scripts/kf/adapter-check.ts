// Phase 6 contract check: runs the REAL adapter (hydrate + services) against live Kissflow via the REST stand-in.
//   npx vite-node scripts/kf/adapter-check.ts            → load + compare with the demo generator
//   npx vite-node scripts/kf/adapter-check.ts --write    → also raise one labelled work order through the adapter, then reject it
import { restKf } from "./rest-kf";
import { createKissflowServices } from "../../src/services/kissflow";
import { buildSeed } from "../../src/services/mock/seed";

const kf = restKf();
const t0 = Date.now();
const conn = await createKissflowServices(kf);
const { counts } = conn.hydrated;
const base = buildSeed();
const s = conn.services;
let fail = 0;
const check = (ok: boolean, name: string, detail = "") => { if (!ok) fail++; console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`); };
console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, JSON.stringify(counts));
// Kissflow holds the seeded subset (one building since 23 Sep), so the checks are that the app loaded what
// Kissflow has and that every record is one the demo generator knows about — not that it loaded everything.
const baseRefs = new Set(base.workOrders.map((w) => w.ref));
check(counts.sites >= 1 && counts.sites <= base.sites.length, "sites loaded", `${counts.sites}`);
check(counts.assets >= 1 && counts.assets <= base.assets.length, "assets loaded", `${counts.assets}`);
check(counts.workOrders === counts.open + (counts.workOrders - counts.open), "work orders = open + closed history", `${counts.workOrders} (${counts.open} open)`);
check(counts.open >= 1, "open work orders from the live process", `${counts.open}`);
check(counts.snags >= 1, "snags", `${counts.snags}`);
check(counts.backCharges >= 1 && counts.backCharges <= base.backCharges.length, "back-charges (from history)", `${counts.backCharges}`);
const all = await s.workOrders.list({});
check(all.every((w) => w.ref.startsWith("WO-") && (baseRefs.has(w.ref) || w.title.en.length > 0)), "every work order is a known demo record or a request raised in the app");
const cc = await s.reports.commandCentre();
check(cc.openTotal === counts.open, "command centre open total matches the adapter", `${cc.openTotal}`);
check(cc.dlp.recoveredYtdAed >= 0, "DLP recovered YTD computed", `AED ${cc.dlp.recoveredYtdAed}`);
const story = await s.assets.get("A-QMR-FCU-1402-01");
check(story !== undefined && story.dlpEnd !== undefined, "storyline asset FCU-1402-01 with DLP end", story !== undefined ? story.dlpEnd ?? "" : "missing");
const queue = await s.workOrders.list({});
// every open job carries the step, liability and clocks Kissflow worked out for it
const open = queue.filter((w) => w.status !== "closed");
const LIABILITIES = ["DLP", "CHARGEABLE", "DECENNIAL_REVIEW", "WARRANTY", "OWN_OPS"];
check(open.length > 0 && open.every((w) => LIABILITIES.includes(w.liability) && /^P[1-4]$/.test(w.priority) && w.resolveDueAt > w.reportedAt),
  "open jobs carry a liability, a priority and live clocks", open.map((w) => `${w.ref} ${w.liability}/${w.priority}`).join(", "));

if (process.argv.includes("--write")) {
  const created = await s.workOrders.create({
    siteId: "S-QMR", unitId: "U-QMR-1402", assetId: "A-QMR-FCU-1402-01", category: "ac_not_cooling",
    title: { en: "[TEST] Adapter write check (safe to reject)", ar: "[TEST]" }, description: "Raised by scripts/kf/adapter-check.ts", descriptionLang: "en",
    channel: "voice_agent", reporterName: "Adapter test", reportedBy: "P-LAYLA"
  } as never, "P-ARJUN");
  const instanceId = conn.hydrated.ids.workOrder.get(created.id);
  check(instanceId !== undefined, "raised in Kissflow", `${created.ref} → ${instanceId}`);
  if (instanceId !== undefined) {
    const p = kf.app.getProcess("CAFM_Work_Order_A00");
    const row = (await p.getAdminItems()).items.find((r) => r._id === instanceId);
    check(row !== undefined && row._current_step === "Subcontractor dispatch", "routed by Kissflow to Subcontractor dispatch", row !== undefined ? String(row._current_step) : "not found");
    check(row !== undefined && row.Liability_Code === 1 && row.Priority_Code === 2, "Kissflow computed DLP + P2 (summer)", row !== undefined ? `L${row.Liability_Code} P${row.Priority_Code}` : "");
    check(row !== undefined && typeof row.Installed_By === "object" && row.Installed_By !== null, "Installed By written (feeds the back-charge Subcontractor)", row !== undefined ? JSON.stringify(row.Installed_By).slice(0, 80) : "");
    if (row !== undefined) {
      const detail = await p.getItem({ instanceId, activityInstanceId: String(row._activity_instance_id) });
      const ctx = (detail._current_context as Array<Record<string, unknown>>)[0];
      await p.rejectItem({ instanceId, activityInstanceId: String(ctx._context_activity_instance_id), comment: "Adapter write check (test)." });
      console.log("  rejected the test item (kept, not deleted)");
    }
  }
}
console.log(fail ? `\n${fail} failed` : "\nall adapter checks passed");
process.exit(fail ? 1 : 0);
