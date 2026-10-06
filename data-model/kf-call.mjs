// Tiny authenticated Kissflow REST helper for Phase 4 checks (reads CAFM/.env; never prints secrets).
// usage: node kf-call.mjs GET "/flow/2/{acc}/application/CAFM_POC_A00"   ({acc} is substituted)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
export function loadEnv() {
  const p = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
export async function kf(method, path, body) {
  loadEnv();
  const host = process.env.KF_DOMAIN.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const url = `https://${host}${path.replaceAll("{acc}", process.env.KF_ACCOUNT_ID)}`;
  let r;
  for (let attempt = 0; attempt < 6; attempt++) { // back off on rate limiting (429)
    r = await fetch(url, { method, headers: { "X-Access-Key-Id": process.env.KF_ACCESS_KEY_ID, "X-Access-Key-Secret": process.env.KF_ACCESS_KEY_SECRET, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (r.status !== 429) break;
    await new Promise((res) => setTimeout(res, 4000 * (attempt + 1)));
  }
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , method, path, body] = process.argv;
  const r = await kf(method, path, body ? JSON.parse(body) : undefined);
  console.log(r.status, JSON.stringify(r.json, null, 1).slice(0, 4000));
}
