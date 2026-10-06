// Records the demo film: drives the real app in a 1080p browser, burns in captions and Kissflow title cards,
// and holds every beat for as long as its narration lasts (scripts/video/build/audio/manifest.json).
// usage: node scripts/video/record.mjs        (needs npm run dev on 5188 and narrate.mjs run first)
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BEATS, VIDEO } from "./storyboard.mjs";

const OUT = new URL("./build/", import.meta.url);
const RAW = new URL("./build/raw/", import.meta.url);
mkdirSync(RAW, { recursive: true });
const durations = new Map(JSON.parse(readFileSync(new URL("./build/audio/manifest.json", import.meta.url), "utf8")).map((m) => [m.id, m.ms]));
const logo = readFileSync(new URL("../../../KF assets/PNG/Kissflow_Horizontal-01.png", import.meta.url)).toString("base64");

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: VIDEO.width, height: VIDEO.height },
  deviceScaleFactor: 1,
  recordVideo: { dir: fileURLToPath(RAW), size: { width: VIDEO.width, height: VIDEO.height } },
  reducedMotion: "no-preference"
});
// a fixed temperature and a signed-in role, so the recording is deterministic
await ctx.addInitScript(() => {
  try {
    sessionStorage.setItem("cafm.weather", JSON.stringify({ temperatureC: 41, source: "live", fetchedAt: Date.now() }));
    localStorage.setItem("cafm.voiceEngine", "demo"); // the scripted call: no microphone needed, same screens
  } catch { /* storage blocked */ }
});
const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);

/** Caption bar and title cards live in a layer above the app, so nothing about the product is altered. */
async function installOverlay() {
  await page.evaluate((logoData) => {
    if (document.getElementById("kf-film") !== null) return;
    const style = document.createElement("style");
    style.textContent = `
      #kf-film { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; font-family: "Readex Pro", system-ui, sans-serif; }
      #kf-cap { position: absolute; left: 50%; bottom: 46px; transform: translateX(-50%) translateY(14px); opacity: 0;
        background: rgba(16,18,20,.92); color: #fff; padding: 14px 26px; border-radius: 10px; font-size: 27px; line-height: 1.25;
        max-width: 1180px; text-align: center; transition: opacity .45s ease, transform .45s ease; box-shadow: 0 12px 40px rgba(0,0,0,.28); }
      #kf-cap.on { opacity: 1; transform: translateX(-50%) translateY(0); }
      #kf-card { position: absolute; inset: 0; background: #fbfbfa; display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 30px; opacity: 0; transition: opacity .6s ease; }
      #kf-card.on { opacity: 1; }
      #kf-card img { width: 340px; }
      #kf-card h1 { font-size: 62px; margin: 0; color: #16191c; font-weight: 600; letter-spacing: -.02em; }
      #kf-card p { font-size: 27px; margin: 0; color: #5c636a; }
      #kf-card .rule { width: 92px; height: 4px; background: #ff5a1f; border-radius: 2px; }
    `;
    document.head.appendChild(style);
    const layer = document.createElement("div");
    layer.id = "kf-film";
    layer.innerHTML = `<div id="kf-card"><img src="data:image/png;base64,${logoData}" alt=""><div class="rule"></div><h1></h1><p></p></div><div id="kf-cap"></div>`;
    document.body.appendChild(layer);
  }, logo);
}

const caption = (text) => page.evaluate((t) => {
  const el = document.getElementById("kf-cap");
  if (el === null) return;
  if (t === null) { el.classList.remove("on"); return; }
  el.textContent = t;
  el.classList.add("on");
}, text);

const card = (data) => page.evaluate((c) => {
  const el = document.getElementById("kf-card");
  if (el === null) return;
  if (c === null) { el.classList.remove("on"); return; }
  el.querySelector("h1").textContent = c.title;
  el.querySelector("p").textContent = c.subtitle;
  el.classList.add("on");
}, data);

const click = async (selector, timeout = 8000) => {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout }).catch(() => undefined);
  if (await el.count() > 0) await el.click({ timeout }).catch(() => undefined);
};

/** Actions a beat can ask for, beyond "show this screen". */
const ACTIONS = {
  "voice-start": async () => { await click('button:has-text("Play a demo call")'); await wait(1500); },
  "voice-continue": async () => wait(500),
  "voice-finish": async () => wait(500),
  "arabic-glance": async () => { await click('button:has-text("تشغيل مكالمة تجريبية")'); await wait(1800); },
  "tech-open": async () => { await click('a:has-text("AC not cooling")'); await wait(1600); }
};

const roleNow = { role: null, lang: "en" };
async function setUp(beat) {
  const role = beat.role ?? roleNow.role;
  const lang = beat.lang ?? roleNow.lang;
  if (role === roleNow.role && lang === roleNow.lang) return false;
  await page.evaluate(([r, l]) => { localStorage.setItem("cafm.role", r); localStorage.setItem("cafm.lang", l); }, [role ?? "executive", lang]);
  roleNow.role = role; roleNow.lang = lang;
  return true;
}

console.log("recording…");
const t0 = Date.now(); // the recording starts with the context; every beat is placed against this
await page.goto(`${VIDEO.base}/?brand=generic#/command`);
await page.waitForTimeout(9000); // first load pulls the data from Kissflow
await installOverlay();

const timeline = [];
for (const beat of BEATS) {
  const say = durations.get(beat.id) ?? 2500;
  const total = say + (beat.hold ?? VIDEO.pad);
  const switched = await setUp(beat);
  if (beat.goto !== undefined || switched) {
    const target = `${VIDEO.base}/?brand=generic${beat.goto ?? ""}`;
    await page.goto(target);
    if (switched) await page.reload();                 // a persona change only takes effect on a fresh load
    await page.waitForTimeout(switched ? 9000 : 2600); // a fresh load pulls the data from Kissflow
    await installOverlay();
  }
  await card(beat.card ?? null);
  await caption(beat.caption ?? null);
  if (beat.action !== undefined && ACTIONS[beat.action] !== undefined) await ACTIONS[beat.action]();
  const started = Date.now() - t0; // the narration for this beat starts here
  await wait(total);
  await caption(null);
  timeline.push({ id: beat.id, startMs: started, sayMs: say, totalMs: total });
  console.log(`· ${beat.id.padEnd(14)} ${(total / 1000).toFixed(1)}s   (t+${(started / 1000).toFixed(0)}s)`);
}
const elapsed = Date.now() - t0;
await wait(600);

await page.close();
await ctx.close();
await browser.close();

const file = readdirSync(RAW).find((f) => f.endsWith(".webm"));
renameSync(new URL(`./${file}`, RAW), new URL("./screen.webm", OUT));
writeFileSync(new URL("./timeline.json", OUT), JSON.stringify(timeline, null, 1));
console.log(`\nscreen recording: ${(elapsed / 1000 / 60).toFixed(1)} min → scripts/video/build/screen.webm`);
