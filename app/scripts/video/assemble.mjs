// Cuts the recording down to the beats (dropping the page loads between them), lays the narration over it and
// writes a 1080p MP4 that plays anywhere: Keynote, PowerPoint, Teams, LinkedIn.
// usage: node scripts/video/assemble.mjs [--name CAFM-demo]
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const BUILD = fileURLToPath(new URL("./build/", import.meta.url));
const CUTS = `${BUILD}cuts/`;
const arg = (flag, fallback) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : fallback);
const name = arg("--name", "CAFM-demo");
/** Quiet tail kept after each narration line, before the cut. */
const PAD_MS = Number(arg("--pad", "700"));
/** Gentle overall speed-up: the voice stays natural up to about 1.25×. */
const SPEED = Number(arg("--speed", "1"));
const timeline = JSON.parse(readFileSync(`${BUILD}timeline.json`, "utf8"))
  .map((b) => ({ ...b, totalMs: b.sayMs + PAD_MS })); // hold each beat for its narration plus a short breath
const ff = (args) => execFileSync(ffmpegPath, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });

rmSync(CUTS, { recursive: true, force: true });
mkdirSync(CUTS, { recursive: true });

// 1. one clip per beat, re-encoded so the cuts are frame-accurate and the whole film shares a codec
const FADE = 0.4;
console.log("cutting beats…");
const list = [];
timeline.forEach((b, i) => {
  const out = `${CUTS}${String(i).padStart(2, "0")}-${b.id}.mp4`;
  const dur = (b.totalMs / 1000).toFixed(3);
  const fades = `fade=t=in:st=0:d=${FADE},fade=t=out:st=${(b.totalMs / 1000 - FADE).toFixed(3)}:d=${FADE}`;
  ff(["-ss", (b.startMs / 1000).toFixed(3), "-t", dur, "-i", `${BUILD}screen.webm`,
    "-vf", `${fades},scale=1920:1080:flags=lanczos,format=yuv420p`, "-r", "30",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-an", out]);
  list.push(out);
  console.log(`· ${b.id.padEnd(14)} ${dur}s`);
});

// 2. join them
writeFileSync(`${CUTS}list.txt`, list.map((f) => `file '${f}'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", `${CUTS}list.txt`, "-c", "copy", `${BUILD}picture.mp4`]);

// 3. the voice-over, each clip placed at the start of its own beat
const starts = [];
let at = 0;
for (const b of timeline) { starts.push(at); at += b.totalMs; }
const inputs = timeline.flatMap((b) => ["-i", `${BUILD}audio/${b.id}.wav`]);
const delays = timeline.map((b, i) => `[${i}:a]adelay=${starts[i]}|${starts[i]},volume=1.6[a${i}]`).join(";");
const mixed = `${timeline.map((_, i) => `[a${i}]`).join("")}amix=inputs=${timeline.length}:normalize=0:dropout_transition=0[out]`;
ff([...inputs, "-filter_complex", `${delays};${mixed}`, "-map", "[out]", "-t", (at / 1000).toFixed(3), "-ar", "48000", "-ac", "2", `${BUILD}voice.wav`]);

// 4. picture + voice → the film, sped up as a whole so picture and voice stay in step
const out = `${BUILD}${name}.mp4`;
if (SPEED === 1) {
  ff(["-i", `${BUILD}picture.mp4`, "-i", `${BUILD}voice.wav`,
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);
} else {
  ff(["-i", `${BUILD}picture.mp4`, "-i", `${BUILD}voice.wav`,
    "-filter_complex", `[0:v]setpts=PTS/${SPEED}[v];[1:a]atempo=${SPEED}[a]`, "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", "30", "-c:a", "aac", "-b:a", "192k",
    "-shortest", "-movflags", "+faststart", out]);
}

// ffmpeg exits non-zero when asked only to describe a file, so read its report rather than trusting the code
let report = "";
try { execFileSync(ffmpegPath, ["-hide_banner", "-i", out], { stdio: ["ignore", "pipe", "pipe"] }); }
catch (e) { report = String(e.stderr ?? ""); }
console.log(`\n${name}.mp4 · ${(at / 1000 / 60).toFixed(1)} min\n${(report.match(/Duration.*|Stream.*/g) ?? []).join("\n")}`);
