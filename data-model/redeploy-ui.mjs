// Re-deploy the CAFM Custom UI zip INTO THE EXISTING Application component (the one Thomas created by uploading).
// Same legs as the plugin's deploy-ui.mjs ZIP mode (init → PUT bytes → trigger → poll → publish) but it never creates,
// deletes or re-flags anything. usage: node redeploy-ui.mjs ../app/cafm-poc.zip
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { randomBytes } from "node:crypto";
import { kf } from "./kf-call.mjs";
const APP = "CAFM_POC_A00", COMPONENT = "CCEEnppREPBs";
const cbase = `/application/2/{acc}/${APP}/component/custom`;
const zipPath = process.argv[2] ?? "../app/cafm-poc.zip";
const bytes = readFileSync(zipPath), name = basename(zipPath), size = bytes.length;
const list = await kf("GET", `${cbase}/list?page_number=1&page_size=300&Category=Application`);
const comps = Array.isArray(list.json) ? list.json : list.json?.Data ?? [];
if (!comps.some((c) => c._id === COMPONENT)) throw new Error(`component ${COMPONENT} not found; refusing to create one`);
const aid = `Attach_${randomBytes(6).toString("base64url")}`;
const init = await kf("POST", `/upload/2/{acc}/?_application_id=${APP}`, { name, size, key: `/${APP}/component/${COMPONENT}/${aid}/${name}`, mimeType: "application/zip" });
console.log("init", init.status, init.json?.Url ? "signed url ok" : JSON.stringify(init.json).slice(0, 200));
if (init.status >= 300 || !init.json?.Url) process.exit(1);
const put = await fetch(init.json.Url, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: bytes });
console.log("put bytes", put.status);
if (put.status >= 300) process.exit(1);
const key = init.json.Key ?? `${APP}/component/${COMPONENT}/${aid}/${name}`;
const now = new Date().toISOString();
const trig = await kf("POST", `${cbase}/${COMPONENT}/trigger?_application_id=${APP}`, [{ uploaded: 100, name, id: aid, key, size, fileExtension: "zip", _modified_at: now, _created_at: now }]);
console.log("trigger", trig.status, trig.status >= 300 ? JSON.stringify(trig.json).slice(0, 200) : "");
if (trig.status >= 300) process.exit(1);
let st;
for (let i = 0; i < 90; i++) {
  const r = await kf("GET", `${cbase}/${COMPONENT}/upload/status`);
  st = r.json?.Status;
  if (st === "Completed" || st === "Failed" || !["Started", "InProgress"].includes(st)) { console.log("status", st, st === "Failed" ? JSON.stringify(r.json).slice(0, 300) : ""); break; }
  await new Promise((res) => setTimeout(res, 1500));
}
if (st === "Failed") process.exit(1);
const pub = await kf("POST", `${cbase}/${COMPONENT}/publish?_application_id=${APP}`, { Source: "Zip" });
console.log("publish", pub.status, pub.status >= 300 ? JSON.stringify(pub.json).slice(0, 200) : "");
