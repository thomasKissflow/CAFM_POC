// Voice agent: plays the scripted demo call (EN/AR), checks barge-in, WO creation, transcript on the helpdesk side.
// usage: node scripts/e2e-voice.mjs [base] [en|ar]
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://localhost:5188";
const lang = process.argv[3] ?? "en";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(([l]) => { localStorage.setItem("cafm.role", "resident"); localStorage.setItem("cafm.lang", l); }, [lang]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${base}/?data=mock#/me/voice`);
await page.waitForTimeout(900);
const t0 = Date.now();
await page.getByRole("button", { name: lang === "ar" ? "تشغيل مكالمة تجريبية" : "Play a demo call" }).click();
await page.getByRole("button", { name: "Mute voice" }).click(); // silent pacing (headless has no TTS voices)
await page.getByRole("button", { name: lang === "ar" ? "المحادثة" : "Transcript" }).click();
const logged = page.getByText(lang === "ar" ? "تم تسجيل الطلب" : "Request logged").last();
await logged.waitFor({ timeout: 90_000 });
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const ref = (await page.locator(".reading").filter({ hasText: /^WO-/ }).first().textContent())?.trim();
const interrupted = await page.getByText(lang === "ar" ? "(قوطِع)" : "(interrupted)").count();
await page.waitForTimeout(6000); // let the confirmation play out
const tx = await page.locator("div.max-h-40").innerText();
await page.screenshot({ path: `../.impeccable/review/voice-${lang}.png` });
// helpdesk side
await page.evaluate(() => localStorage.setItem("cafm.role", "helpdesk"));
await page.goto(`${base}/?data=mock#/queue`);
await page.waitForTimeout(900);
await page.getByText(ref ?? "WO-none").first().click();
await page.waitForTimeout(900);
const panel = await page.getByText(lang === "ar" ? "محادثة المساعد الصوتي" : "Voice call transcript").count();
const chan = await page.getByText(lang === "ar" ? "المساعد الصوتي" : "Voice agent").count();
await page.screenshot({ path: `../.impeccable/review/voice-${lang}-wo.png`, fullPage: true });
console.log(`lang=${lang} ref=${ref} call=${secs}s interruptedMarks=${interrupted} transcriptPanel=${panel > 0} channelShown=${chan > 0}`);
console.log(tx);
console.log(`errors: ${errors.length ? errors.join(" | ") : "none"}`);
await browser.close();
