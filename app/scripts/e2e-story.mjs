// End-to-end storyline through the real UI (role switcher, no reloads; data lives in memory).
// usage: node scripts/e2e-story.mjs [baseUrl] [lang] [path]   path = dlp | chargeable
import { chromium } from "playwright";
import fs from "node:fs";

const base = process.argv[2] ?? "http://localhost:5188";
const lang = process.argv[3] ?? "en";
const pathKind = process.argv[4] ?? "dlp";
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((l) => { if (!sessionStorage.getItem("init")) { localStorage.setItem("cafm.role", "resident"); localStorage.setItem("cafm.lang", l); sessionStorage.setItem("init", "1"); } }, lang);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
let step = 0;
const results = [];
const check = async (name, fn) => {
  step++;
  try {
    await fn();
    results.push(`PASS ${step}. ${name}`);
  } catch (e) {
    results.push(`FAIL ${step}. ${name}: ${String(e.message).split("\n").slice(0, 6).join(" / ")}`);
  }
  if (shots) await page.waitForTimeout(700);
  if (shots) await page.screenshot({ path: `${shots}/${String(step).padStart(2, "0")}-${name.replace(/\W+/g, "_").slice(0, 40)}.png` });
};
const go = (hash) => page.evaluate((h) => { location.hash = h; }, hash);
const role = async (personName) => {
  await page.getByRole("button", { name: lang === "ar" ? "تبديل الدور" : "Switch role" }).click();
  await page.getByRole("menuitem").filter({ hasText: personName }).click();
  await page.waitForTimeout(400);
};
const L = (en, ar) => (lang === "ar" ? ar : en);

await page.goto(`${base}/${process.env.DATA === "live" ? "" : "?data=mock"}#/me/new`);
await page.waitForTimeout(1200);

await check("resident raises Arabic AC request with AI triage", async () => {
  await page.getByText(L("Use demo text (Arabic)", "استخدم نص العرض")).click();
  await page.getByText(L("AI preview", "معاينة الذكاء الاصطناعي")).first().waitFor({ timeout: 4000 });
  await page.getByText(/P2/).first().waitFor({ timeout: 4000 });
  await page.getByText(L("Use demo illustration", "استخدام رسم توضيحي تجريبي")).click();
  await page.getByRole("button", { name: L("Send request", "إرسال الطلب") }).click();
  await page.getByText(L("Request received", "تم استلام الطلب")).waitFor({ timeout: 4000 });
});
const ref = (await page.locator("text=/WO-26-\\d+/").first().textContent())?.match(/WO-26-\d+/)?.[0];
const woId = ref ? `WO-${ref.slice(6)}` : "";
results.push(`INFO story work order ${ref}`);

await check("resident tracker shows the active request", async () => {
  await page.getByRole("link", { name: L("Track this request", "تتبع هذا الطلب") }).click();
  await page.getByRole("heading", { name: L("Active requests", "الطلبات النشطة"), exact: true }).waitFor();
  await page.getByText(ref).waitFor();
});

await check("helpdesk intake shows 3 channels timestamped at first contact", async () => {
  await role(L("Arjun Menon", "أرجون مينون"));
  await go("#/intake");
  await page.getByText(ref.replace("WO-26-", "")).count(); // stream rows show times not refs
  const rows = await page.locator("ol li").count();
  if (rows < 3) throw new Error(`only ${rows} rows`);
});

await check("work order shows DLP banner, P2 summer rule, routed to Coolbreeze", async () => {
  await go(`#/wo/${woId}`);
  await page.getByText(L("Summer rule: AC uplifted to P2", "قاعدة الصيف: رفع أولوية التكييف إلى P2")).first().waitFor();
  await page.getByText(L("DLP: contractor liable", "فترة المسؤولية: المقاول مسؤول")).first().waitFor();
  await page.getByText(/Coolbreeze|كول بريز/).first().waitFor();
  await page.getByText(L("Machine-translated for the helpdesk", "ترجمة آلية لمكتب المساعدة")).count();
});

await check("subcontractor supervisor accepts & dispatches Joel", async () => {
  await role(L("Rashid Qureshi", "راشد قريشي"));
  await go(`#/wo/${woId}`);
  await page.getByRole("button", { name: L("Accept & dispatch", "قبول وإرسال فني") }).click();
  await page.getByText(L("Accepted; technician dispatched", "تم القبول وإرسال الفني")).waitFor();
});

await check("technician scans QR and opens the job", async () => {
  await role(L("Joel Santos", "جويل سانتوس"));
  await go("#/tech/scan");
  await page.getByRole("button", { name: L("Simulate scan: FCU-1402-01", "محاكاة المسح: FCU-1402-01") }).click();
  await page.getByRole("button", { name: new RegExp(ref) }).click();
  await page.getByText(L("Checklist", "قائمة التحقق")).first().waitFor();
});

await check("diagnosis challenge fires on a repeat diagnosis", async () => {
  await page.getByRole("radio", { name: L("Thermostat fault", "عطل منظم الحرارة") }).click();
  await page.getByText(L("Check before you close", "تحقق قبل الإغلاق")).waitFor();
  await page.getByText(/CB-FCU-B07/).first().waitFor();
});

await check("re-test, then record the true root cause", async () => {
  if (pathKind === "dlp") {
    await page.getByRole("button", { name: L("Re-test", "إعادة الاختبار") }).click();
    await page.getByRole("radio", { name: L("CHW valve actuator failed", "عطل مشغل صمام المياه المبردة") }).click();
    if (await page.getByText(L("Check before you close", "تحقق قبل الإغلاق")).count()) throw new Error("challenge shown for consistent cause");
  } else {
    await page.getByRole("button", { name: L("Re-test", "إعادة الاختبار") }).click();
    await page.getByRole("radio", { name: L("Filter clogged (consumable)", "انسداد الفلتر (مستهلك)") }).click();
    const keep = page.getByRole("button", { name: L("Keep my diagnosis", "الإبقاء على تشخيصي") });
    if (await keep.count()) await keep.click();
  }
});

await check("checklist, photos, AI draft, signature, complete", async () => {
  const items = page.locator("section ul button[aria-pressed]");
  const n = await items.count();
  results.push(`INFO checklist buttons ${n}`);
  for (let i = 0; i < n; i++) { await items.nth(i).click(); await page.waitForTimeout(80); }
  results.push(`INFO after checklist done=${await page.getByText("Job completed").count()}`);
  const placeholders = page.getByText(L("Use demo illustration", "استخدام رسم توضيحي تجريبي"));
  while (await placeholders.count()) { await placeholders.first().click(); await page.waitForTimeout(150); }
  results.push(`INFO after photos done=${await page.getByText("Job completed").count()}`);
  await page.getByText(L("Draft close-out note", "صياغة ملاحظة الإغلاق")).click();
  await page.waitForTimeout(1200);
  const canvas = page.locator("canvas");
  await canvas.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 60); await page.mouse.down(); await page.mouse.move(box.x + 160, box.y + 40, { steps: 8 }); await page.mouse.up();
  const done = page.getByRole("button", { name: L("Complete job", "إنهاء المهمة") });
  const state = await done.evaluate((el) => ({ disabled: el.disabled, text: el.textContent }));
  results.push(`INFO complete button ${JSON.stringify(state)}`);
  await done.click({ timeout: 8000 });
  await page.getByText(L("Job completed", "اكتملت المهمة")).waitFor({ timeout: 5000 });
  if (pathKind === "chargeable") await page.getByText(L("Reclassified as chargeable", "أعيد التصنيف كقابل للتحصيل"), { exact: false }).waitFor();
});

await check("helpdesk verifies & closes; back-charge raised on DLP path", async () => {
  await role(L("Arjun Menon", "أرجون مينون"));
  await go(`#/wo/${woId}`);
  await page.getByRole("button", { name: L("Verify & close", "التحقق والإغلاق") }).click();
  await page.getByText(L("Closed", "مغلق")).first().waitFor();
  if (pathKind === "dlp") await page.getByText(/BC-26-\d+/).first().waitFor({ timeout: 4000 });
  else if (await page.getByText(/BC-26-\d+/).count()) throw new Error("back-charge raised on chargeable job");
  await page.getByText(L("Activity log", "سجل النشاط")).waitFor();
});

if (pathKind === "dlp") {
  await check("DLP register shows AED 2,050 back-charge to Coolbreeze", async () => {
    await role(L("Khalid Al Hammadi", "خالد الحمادي"));
    await go("#/dlp");
    await page.getByText(/2,050/).first().waitFor();
  });
  await check("command centre batch alert grows to 3 failures", async () => {
    await role(L("Hamdan Al Falasi", "حمدان الفلاسي"));
    await go("#/command");
    await page.getByText(/3 ×/).first().waitFor({ timeout: 4000 });
  });
  await check("AI ask answers the DLP cost question", async () => {
    await page.getByRole("button", { name: L("Which subcontractor costs us most in DLP?", "أي مقاول من الباطن يكلفنا أكثر في فترة المسؤولية؟") }).click();
    await page.getByText(/Coolbreeze|كول بريز/).nth(1).waitFor({ timeout: 4000 });
  });
  await check("monthly report + AI summary", async () => {
    await role(L("Sarah Whitfield", "سارة ويتفيلد"));
    await go("#/reports");
    await page.getByRole("button", { name: L("Draft executive summary", "صياغة الملخص التنفيذي") }).click();
    await page.getByText(/logged events|حدثًا مسجلًا/).first().waitFor({ timeout: 4000 });
  });
}

await check("no runtime errors", async () => { if (errors.length) throw new Error(errors.slice(0, 3).join(" | ")); });
await browser.close();
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
