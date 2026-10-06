// Visual QA sweep: every route × role, EN + AR, desktop + phone. Collects console errors.
// usage: node scripts/qa-shots.mjs <outDir> [baseUrl]
//   DATA=live  → run against live Kissflow data (the small seeded world) instead of the demo generator
//   LANGS=en   → one language only
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2] ?? "qa-shots";
const base = process.argv[3] ?? "http://localhost:5188";
fs.mkdirSync(out, { recursive: true });

const desktop = [
  ["command", "executive"], ["portfolio", "executive"], ["intake", "helpdesk"], ["queue", "fm_manager"], ["queue?view=board", "fm_manager"],
  [process.env.DATA === "live" ? "wo/WO-04832" : "wo/WO-04808", "helpdesk"], ["assets", "fm_manager"], ["assets/A-QMR-FCU-1402-01", "fm_manager"], ["dlp", "dlp_manager"],
  ["handover", "dlp_manager"], ["compliance", "compliance"], ["compliance/audit/S-QMR", "compliance"], ["reports", "fm_manager"],
  ["fleet", "plant_manager"], ["permits", "hse"], ["ppm", "fm_manager"], ["subcontractors", "dlp_manager"], ["before", "helpdesk"],
  ["request/new?channel=phone", "helpdesk"], ["admin/data", "admin"], ["admin/conversations", "admin"], ["admin/ai", "admin"],
  ["admin/properties", "admin"], ["admin/brand", "admin"]
];
const phone = [["tech", "technician"], ["tech/scan", "technician"], ["me", "resident"], ["me/new", "resident"], ["me/voice", "resident"], ["public/FCU-1408-01", "resident"], ["command", "executive"], ["queue", "fm_manager"], ["admin/ai", "admin"]];

const browser = await chromium.launch();
const errors = [];
async function shot(route, role, lang, viewport, name) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.addInitScript(([r, l]) => {
    localStorage.setItem("cafm.role", r);
    localStorage.setItem("cafm.lang", l);
    // a fixed temperature: screenshots stay comparable and a sweep does not call the weather service 60 times
    sessionStorage.setItem("cafm.weather", JSON.stringify({ temperatureC: 38, source: "live", measuredAt: "qa", fetchedAt: Date.now() }));
  }, [role, lang]);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${name}: ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`${name}: PAGEERROR ${e.message}`));
  await page.goto(`${base}/${process.env.DATA === "live" ? "" : "?data=mock"}#/${route}`);
  await page.waitForTimeout(process.env.DATA === "live" ? 6000 : 1600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) errors.push(`${name}: horizontal overflow (${await page.evaluate(() => document.documentElement.scrollWidth)}px)`);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  await ctx.close();
}
const langs = (process.env.LANGS ?? "en,ar").split(",");
for (const lang of langs) {
  for (const [route, role] of desktop) await shot(route, role, lang, { width: 1440, height: 900 }, `d-${lang}-${route.replace(/[/?=]/g, "_")}`);
  for (const [route, role] of phone) await shot(route, role, lang, { width: 390, height: 844 }, `m-${lang}-${route.replace(/[/?=]/g, "_")}`);
}
await browser.close();
fs.writeFileSync(path.join(out, "errors.txt"), errors.join("\n"));
console.log(`shots: ${fs.readdirSync(out).length - 1}, errors: ${errors.length}`);
errors.slice(0, 40).forEach((e) => console.log(" -", e));
