// Phase 5 frontend gate: one command, every frontend check. Needs the dev server on 5188 (npm run dev).
// usage: npm run gate
import { execSync } from "node:child_process";
const base = process.env.BASE ?? "http://localhost:5188";
const steps = [
  ["typecheck", "npm run typecheck", (o) => !/error TS/.test(o)],
  ["unit tests", "npx vitest run", (o) => /Tests\s+\d+ passed/.test(o) && !/failed/.test(o)],
  ["storyline EN · DLP", `node scripts/e2e-story.mjs ${base} en dlp`, (o) => !/^FAIL/m.test(o)],
  ["storyline EN · chargeable", `node scripts/e2e-story.mjs ${base} en chargeable`, (o) => !/^FAIL/m.test(o)],
  ["storyline AR · DLP", `node scripts/e2e-story.mjs ${base} ar dlp`, (o) => !/^FAIL/m.test(o)],
  ["storyline AR · chargeable", `node scripts/e2e-story.mjs ${base} ar chargeable`, (o) => !/^FAIL/m.test(o)],
  ["guided demo (14 beats)", `node scripts/e2e-guided.mjs ${base}`, (o) => /errors: none/.test(o) && /2,050 present: true/.test(o)],
  ["voice call EN", `node scripts/e2e-voice.mjs ${base} en`, (o) => /interruptedMarks=1 transcriptPanel=true channelShown=true/.test(o) && /errors: none/.test(o)],
  ["voice call AR", `node scripts/e2e-voice.mjs ${base} ar`, (o) => /interruptedMarks=1 transcriptPanel=true channelShown=true/.test(o) && /errors: none/.test(o)],
  ["all screens × roles × EN/AR × desktop/phone", "node scripts/qa-shots.mjs", (o) => /errors: 0/.test(o)]
];
try { execSync(`curl -sf ${base} -o /dev/null`); } catch { console.error(`✗ dev server not reachable at ${base}: run npm run dev first`); process.exit(2); }
let failed = 0;
for (const [name, cmd, ok] of steps) {
  const t = Date.now(); let out = "";
  try { out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 }); } catch (e) { out = String(e.stdout ?? "") + String(e.stderr ?? ""); }
  const pass = ok(out);
  if (!pass) failed++;
  console.log(`${pass ? "✓" : "✗"} ${name} (${((Date.now() - t) / 1000).toFixed(0)}s)${pass ? "" : "\n" + out.split("\n").filter((l) => /FAIL|✗|error|Error/.test(l)).slice(0, 6).join("\n")}`);
}
console.log(failed ? `\n${failed} of ${steps.length} failed` : `\nall ${steps.length} passed`);
process.exit(failed ? 1 : 0);
