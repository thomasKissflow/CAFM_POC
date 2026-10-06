// POC only (Thomas's decision, 22 Sep): copy GEMINI_API_KEY from the project .env into the Kissflow
// "AI Settings" form, so the Custom UI can run live voice with no server of ours. The value is never printed
// or logged: only its length and last 4 characters, so you can tell which key is stored.
// usage: node put-gemini-key.mjs [--remove]      Production: keep the key on the server instead (PRODUCTION_TODO.md).
import { readFileSync } from "node:fs";
import { kf } from "./kf-call.mjs";

const FORM = "CAFM_AI_Setting_A00", Q = "?_application_id=CAFM_POC_A00", KEY = "gemini_api_key";
const remove = process.argv.includes("--remove");
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m !== null && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const value = (process.env.GEMINI_API_KEY ?? "").trim();
if (!remove && value === "") { console.error("GEMINI_API_KEY is not set in ../.env"); process.exit(1); }

const list = await kf("POST", `/form/2/{acc}/${FORM}/allitems/list${Q}&page_size=100&page_number=1`, {});
const existing = (list.json.Data ?? []).find((r) => r.Setting_Key === KEY);
const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const row = { Setting_Key: KEY, Setting_Value: remove ? "" : value, Updated_By: "Thomas (POC setup)", Updated_At: now };
const r = await kf("POST", `/form/2/{acc}/${FORM}/batch${Q}`, [existing !== undefined ? { _id: existing._id, ...row } : { ...row, _is_created: true }]);
console.log(`${r.status < 300 ? "✓" : "✗"} ${remove ? "cleared" : "stored"} ${KEY} in Kissflow (${r.status})${remove ? "" : ` · ${value.length} characters, ends …${value.slice(-4)}`}`);

const back = await kf("POST", `/form/2/{acc}/${FORM}/allitems/list${Q}&page_size=100&page_number=1`, {});
const saved = (back.json.Data ?? []).find((x) => x.Setting_Key === KEY);
const v = saved !== undefined ? String(saved.Setting_Value ?? "") : "";
console.log(`read back: ${v === "" ? "empty" : `${v.length} characters, ends …${v.slice(-4)}`}${!remove && v === value ? " (matches)" : ""}`);
