// Rejects work orders raised while testing (Kissflow refuses deletes for this key; a rejected item leaves the app's views).
// usage: node reject-test-wos.mjs "WO-26-04856"
import { kf } from "./kf-call.mjs";
const Q = "?_application_id=CAFM_POC_A00", P = "CAFM_Work_Order_A00";
const match = process.argv[2];
if (match === undefined) { console.log('usage: node reject-test-wos.mjs "WO-26-04856"'); process.exit(1); }
const r = await kf("POST", `/process/2/{acc}/${P}/myitems/inprogress?apply_preference=false&page_number=1&page_size=200&_application_id=CAFM_POC_A00`, { Columns: [{ Id: "Request_Title" }, { Id: "Site" }] });
for (const row of (r.json?.Data ?? []).filter((x) => String(x.Request_Title ?? "").includes(match))) {
  const listed = row._activity_instance_id;
  let aiid = listed;
  if (listed !== undefined) {
    const detail = (await kf("GET", `/process/2/{acc}/${P}/${row._id}/${listed}${Q}&_response_type=full`)).json;
    const ctx = Array.isArray(detail?._current_context) ? detail._current_context[0] : undefined;
    if (ctx?._context_activity_instance_id !== undefined) aiid = ctx._context_activity_instance_id;
  }
  const rej = await kf("POST", `/process/2/{acc}/${P}/${row._id}/${aiid}/reject${Q}`, { Note: "Raised while testing Admin → Properties, 1 Oct." });
  console.log("reject", row.Request_Title, row.Site?.Site_Name ?? "", rej.status);
}
