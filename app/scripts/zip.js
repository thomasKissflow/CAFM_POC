// Package dist/ as a zip for Kissflow Custom UI upload (same approach as @kissflow/create-app).
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ZipArchive } from "archiver"; // archiver 8: named classes, no default export

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { name } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const dist = path.join(root, "dist");
const zipPath = path.join(root, `${name}.zip`);
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
execSync("npm run build", { cwd: root, stdio: "inherit" });
const out = fs.createWriteStream(zipPath);
const archive = new ZipArchive({ zlib: { level: 9 } });
archive.pipe(out);
archive.directory(dist, false);
await archive.finalize();
console.log(`Packaged ${zipPath}`);
