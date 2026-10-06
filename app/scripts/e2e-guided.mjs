// Walks the guided demo: every beat, running "do it for me" actions; checks routes and errors.
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:5188";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${base}/?data=mock#/command`);
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Start guided demo" }).click();
const panel = page.getByRole("complementary", { name: "Guided demo" });
const log = [];
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(700);
  const title = await panel.locator("h2").textContent();
  const action = panel.locator("button").filter({ hasNotText: /Previous|Next beat/ }).filter({ has: page.locator("svg.lucide-wand-sparkles, svg.lucide-wand2, svg.lucide-wand-2") });
  if (await action.count()) { await action.first().click(); await page.waitForTimeout(900); }
  log.push(`${i + 1}. ${title} → ${new URL(page.url()).hash}`);
  const next = panel.getByRole("button", { name: "Next beat" });
  if (await next.isDisabled()) break;
  await next.click();
}
await page.evaluate(() => { location.hash = "#/dlp"; });
await page.waitForTimeout(800);
const bc = await page.getByText(/2,050/).count();
console.log(log.join("\n"));
console.log(`back-charge AED 2,050 present: ${bc > 0}`);
console.log(`errors: ${errors.length ? errors.join(" | ") : "none"}`);
await browser.close();
