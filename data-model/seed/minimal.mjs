// Trims the demo world to one building so the app is easy to follow record by record (Thomas, 23 Sep).
// Shared by seed.mjs and seed-live-wos.mjs so both seed exactly the same subset.
export /** One building, a handful of apartments, assets and jobs: small enough to follow record by record (Thomas, 23 Sep).
 *  Reference lists (request types, fault causes, SLA targets, asset types) stay complete: the app and the voice
 *  agent look records up in them, so a missing row would break a request rather than simplify it. */
function applyMinimal(d) {
  const SITE = "S-QMR";
  const UNITS = ["U-QMR-1402", "U-QMR-2407", "U-QMR-1305", "U-QMR-1511"];
  const ALL_UNITS = d.units;
  d.sites = d.sites.filter((x) => x.id === SITE);
  d.units = d.units.filter((x) => UNITS.includes(x.id));
  const buildingAssets = d.assets.filter((a) => a.siteId === SITE && a.unitId === undefined).slice(0, 2);
  d.assets = [...d.assets.filter((a) => a.siteId === SITE && UNITS.includes(a.unitId ?? "")), ...buildingAssets];
  const assetIds = new Set(d.assets.map((a) => a.id));
  const mine = d.workOrders.filter((w) => w.siteId === SITE && (w.assetId === undefined || assetIds.has(w.assetId)));
  const open = mine.filter((w) => w.status !== "closed");
  // closed jobs that tell the money story: some recovered from the subcontractor, some issued, some disputed
  const bcByWo = new Map(d.backCharges.map((b) => [b.workOrderId, b]));
  const closedAll = mine.filter((w) => w.status === "closed").sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
  const closed = [];
  // the story asset's own history first: "third time this summer" is the heart of the demo, and the batch
  // siblings are what the batch-defect panel points at
  const STORY_ASSETS = ["A-QMR-FCU-1402-01", "A-QMR-FCU-1305-01", "A-QMR-FCU-1511-01"];
  for (const w of closedAll.filter((x) => STORY_ASSETS.includes(x.assetId ?? ""))) closed.push(w);
  for (const status of ["recovered", "issued", "disputed"]) {
    for (const w of closedAll.filter((x) => bcByWo.get(x.id)?.status === status && !closed.includes(x)).slice(0, 2)) closed.push(w);
  }
  for (const w of closedAll) { if (closed.length >= 12) break; if (!closed.includes(w)) closed.push(w); }
  d.workOrders = [...open, ...closed].sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
  const woIds = new Set(d.workOrders.map((w) => w.id));
  d.backCharges = d.backCharges.filter((b) => woIds.has(b.workOrderId));
  // one snag per status, so the handover board shows movement rather than three identical cards
  const bySnagStatus = new Map();
  for (const x of d.snags.filter((y) => y.siteId === SITE)) if (!bySnagStatus.has(x.status)) bySnagStatus.set(x.status, x);
  d.snags = [...bySnagStatus.values()].slice(0, 4);
  d.compliance = d.compliance.filter((x) => x.siteId === SITE).slice(0, 2);
  d.ppm = d.ppm.filter((x) => x.siteId === SITE).slice(0, 2);
  d.permits = d.permits.filter((x) => x.siteId === SITE).slice(0, 1);
  // keep one plant item that actually has a breakdown, so the breakdown board isn't empty
  const withBreakdown = d.equipment.find((e) => d.breakdowns.some((b) => b.equipmentId === e.id));
  d.equipment = [...(withBreakdown !== undefined ? [withBreakdown] : []), ...d.equipment.filter((e) => e.id !== withBreakdown?.id)].slice(0, 2);
  const eqIds = new Set(d.equipment.map((e) => e.id));
  d.breakdowns = d.breakdowns.filter((b) => eqIds.has(b.equipmentId)).slice(0, 1);
  // every subcontractor still referenced anywhere must stay, or the record that points at it cannot be created
  // apartments referenced by the jobs and snags we kept, so every record points at something that exists
  const unitIds = new Set([...UNITS, ...d.workOrders.map((w) => w.unitId), ...d.snags.map((x) => x.unitId)].filter((x) => x !== undefined));
  d.units = ALL_UNITS.filter((u) => unitIds.has(u.id));
  const subs = new Set([...d.assets.map((a) => a.installedById ?? a.installedBy), ...d.workOrders.map((w) => w.subcontractorId),
    ...d.snags.map((x) => x.subcontractorId), ...d.compliance.map((x) => x.contractorId), ...d.ppm.map((x) => x.contractorId)].filter((x) => x !== undefined));
  d.subcontractors = d.subcontractors.filter((x) => subs.has(x.id));
  // the building's size on screen is the number of apartments we actually keep
  for (const site of d.sites) site.unitCount = d.units.filter((u) => u.siteId === site.id).length;
  // figures that describe the register must match the register we keep, or the screens contradict themselves
  const perClass = (cls) => d.assets.filter((a) => a.assetClass === cls).length;
  for (const p of d.ppm) if (p.assetClass !== undefined) p.assetCount = Math.max(1, perClass(p.assetClass));
  for (const items of Object.values(d.handoverPack ?? {})) for (const item of items) if (item.id === "HP-5") item.count = d.assets.length;
  console.log(`minimal: ${d.sites.length} site · ${d.units.length} apartments · ${d.assets.length} assets · ${d.subcontractors.length} subcontractors · ${open.length} open + ${closed.length} closed work orders · ${d.snags.length} snags · ${d.compliance.length} certificates · ${d.ppm.length} PPM · ${d.equipment.length} plant`);
}
