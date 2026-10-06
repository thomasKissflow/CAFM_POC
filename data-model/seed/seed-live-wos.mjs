// Seeds the demo's open work orders as REAL Work Order process items and walks each to its current step.
// Copy fields are written the way the Custom UI adapter will (API creates don't autofill). Idempotent by title (ref-prefixed).
import { readFileSync } from "node:fs";
import { rows, create, submit, state, fmt } from "../kf-flow.mjs";
import { applyMinimal } from "./minimal.mjs";
const { db, ref } = JSON.parse(readFileSync(new URL("./mock-db.json", import.meta.url), "utf8"));
if (process.argv.includes("--minimal")) applyMinimal(db);
const P = "CAFM_Work_Order_A00";
const CHANNEL = { resident_app: "Resident app", voice_agent: "Voice agent", qr_public: "QR poster", phone: "Phone call", helpdesk: "Helpdesk", ppm: "PPM schedule", email: "Email", whatsapp: "WhatsApp", bms: "BMS alarm" };
const sites = await rows("CAFM_Site_A00"), cats = await rows("CAFM_Request_Category_A00");
const assets = []; for (let p = 1; ; p++) { const { kf } = await import("../kf-call.mjs"); const d = (await kf("POST", `/form/2/{acc}/CAFM_Asset_A00/allitems/list?_application_id=CAFM_POC_A00&page_size=1000&page_number=${p}`, {})).json?.Data ?? []; assets.push(...d); if (d.length < 1000) break; }
const open = db.workOrders.filter((w) => w.status !== "closed");
for (const w of open) {
  const site = db.sites.find((s) => s.id === w.siteId), S = sites.find((s) => s.Site_Code === site.code), C = cats.find((c) => c.Category_Code === w.category);
  const a = w.assetId ? assets.find((x) => x.QR_Code === db.assets.find((y) => y.id === w.assetId)?.qrCode) : null;
  const title = `${w.ref} · ${w.title.en}`;
  const id = await create(P, {
    Site: { _id: S._id }, Category: { _id: C._id }, ...(a ? { Asset: { _id: a._id } } : {}), Request_Title: title, Description: w.description, Channel: CHANNEL[w.channel],
    Reporter_Name: w.reporterName, First_Contact_At: new Date(w.reportedAt).toISOString().replace(".000Z", "Z"),
    Own_Operations: S.Own_Operations ?? false, Base_Priority: C.Base_Priority, Summer_Uplift: C.Summer_Uplift ?? false, Structural: C.Structural ?? false,
    Asset_Tag: a?.Asset_Tag, Batch: a?.Batch, DLP_End_Date: a?.DLP_End_Date ?? S.DLP_End_Date, Warranty_End_Date: a?.Warranty_End_Date
    // Only a live item counts as "already seeded": a completed one with the same reference is history from an
    // earlier demo (references repeat across runs), and the demo needs this job OPEN.
  }, "Request_Title", ["draft", "inprogress"]);
  let s = await state(P, id);
  const target = w.status === "assigned" ? 2 : 3; // 2 = at dispatch, 3 = at work in progress
  for (let i = 0; i < 4; i++) {
    const idx = ["Request raised", "Triage", "Subcontractor dispatch|FM dispatch|Engineering review", "Work in progress"].findIndex((x) => new RegExp(`^(${x})$`).test(s.step ?? (s.view === "draft" ? "Request raised" : "")));
    if (idx < 0 || idx >= target) break;
    s = await submit(P, id);
  }
  const it = s.item ?? {};
  const want = { DLP: 1, CHARGEABLE: 2, DECENNIAL_REVIEW: 3, WARRANTY: 4, OWN_OPS: 5 }[w.liability];
  console.log(`${it.Liability_Code === want ? "✓" : "✗"} ${title.padEnd(48).slice(0, 48)} demo ${w.liability}/${w.priority} · kissflow L${it.Liability_Code} P${it.Priority_Code} · ${fmt(s)}`);
}
