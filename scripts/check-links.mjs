#!/usr/bin/env node
// Checks the built site (dist/) for broken internal links, missing #anchors, missing images and
// basic SEO problems (title, description, h1, canonical). Run: npm run build && npm run check
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (!existsSync(DIST)) { console.error("dist/ not found. Run `npm run build` first."); process.exit(2); }

const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(DIST);
const pages = files.filter((f) => f.endsWith(".html"));
const urlOf = (file) => "/" + file.slice(DIST.length + 1).replace(/index\.html$/, "");

const ids = new Map();
const html = new Map();
for (const f of pages) {
  const src = readFileSync(f, "utf8");
  html.set(urlOf(f), src);
  ids.set(urlOf(f), new Set([...src.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
}
const exists = (p) => {
  if (html.has(p)) return true;
  const file = join(DIST, p.replace(/^\//, ""));
  return existsSync(file) && statSync(file).isFile();
};

const problems = [];
const seenTitles = new Map();
for (const [url, src] of html) {
  if (url === "/404.html" || url.startsWith("/go/")) continue;
  const title = src.match(/<title>([^<]*)<\/title>/)?.[1] || "";
  const desc = src.match(/<meta name="description" content="([^"]*)"/)?.[1] || "";
  const h1s = (src.match(/<h1[\s>]/g) || []).length;
  if (!title) problems.push(`${url}: missing <title>`);
  if (title.length > 70) problems.push(`${url}: title is ${title.length} chars`);
  if (!desc) problems.push(`${url}: missing meta description`);
  if (desc.length > 170) problems.push(`${url}: meta description is ${desc.length} chars`);
  if (h1s !== 1) problems.push(`${url}: has ${h1s} <h1> elements (want 1)`);
  if (!/<link rel="canonical"/.test(src)) problems.push(`${url}: missing canonical`);
  if (seenTitles.has(title)) problems.push(`${url}: duplicate <title> with ${seenTitles.get(title)}`);
  seenTitles.set(title, url);

  for (const m of src.matchAll(/(?:href|src)="([^"]+)"/g)) {
    let target = m[1].replace(/&amp;/g, "&");
    if (/^(https?:|mailto:|tel:|data:|javascript:)/.test(target)) continue;
    const [pathPart, hash] = target.split("#");
    const path = pathPart || url;
    const clean = path.split("?")[0];
    if (!exists(clean)) { problems.push(`${url}: broken link -> ${target}`); continue; }
    if (hash && html.has(clean) && !ids.get(clean).has(hash)) problems.push(`${url}: missing anchor -> ${target}`);
  }
}

const sitemap = readFileSync(join(DIST, "sitemap.xml"), "utf8");
for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const p = new URL(m[1]).pathname;
  if (!exists(p)) problems.push(`sitemap.xml lists a missing page: ${p}`);
}

console.log(`Checked ${pages.length} pages.`);
if (problems.length) {
  console.log(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  for (const p of [...new Set(problems)]) console.log("  - " + p);
  process.exit(1);
}
console.log("No broken links, anchors or basic SEO problems found.");
