#!/usr/bin/env node
// Local preview: rebuilds on every change and serves dist/ at http://localhost:3000
//   npm run dev            (add PORT=4000 to change the port)
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, watch } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const PORT = Number(process.env.PORT || 3000);
const extra = process.argv.slice(2);

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff": "font/woff", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json",
};

function build() {
  const r = spawnSync(process.execPath, [join(ROOT, "build.mjs"), "--drafts", "--future", ...extra], { cwd: ROOT, encoding: "utf8" });
  const first = (r.stdout || "").split("\n")[0];
  console.log(r.status === 0 ? `[build] ${first}` : `[build failed]\n${r.stderr || r.stdout}`);
}
build();

let timer;
for (const dir of ["content", "data", "static", "lib"]) {
  watch(join(ROOT, dir), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(build, 150); });
}
for (const f of ["build.mjs", "site.config.mjs"]) watch(join(ROOT, f), () => { clearTimeout(timer); timer = setTimeout(build, 150); });

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = normalize(join(DIST, path));
  if (!file.startsWith(DIST)) { res.writeHead(403).end("Forbidden"); return; }
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith("/")) { res.writeHead(301, { Location: `${path}/` }).end(); return; }
    file = join(file, "index.html");
  }
  if (!existsSync(file)) {
    res.writeHead(404, { "Content-Type": TYPES[".html"] }).end(existsSync(join(DIST, "404.html")) ? readFileSync(join(DIST, "404.html")) : "Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }).end(readFileSync(file));
}).listen(PORT, () => console.log(`Loopwise preview: http://localhost:${PORT}  (Ctrl+C to stop)`));
