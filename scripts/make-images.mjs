#!/usr/bin/env node
// Generates favicon, app icons and social share images (1200x630) into static/.
// Run after adding posts:  npm run og      (needs `sharp`, installed as a devDependency)
// The PNGs are committed, so deploys do not depend on fonts being installed on the build machine.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import site from "../site.config.mjs";
import { parseFrontmatter } from "../lib/frontmatter.mjs";
import { escapeXml } from "../lib/util.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC = join(ROOT, "static");
mkdirSync(join(STATIC, "og"), { recursive: true });

const INK = "#0D1A3F";
const FOG = "#F1F4F9";
const SIGNAL = "#FF7A00";
const DISPLAY = "Inter Display, Inter, Helvetica, Arial, sans-serif";

// ---------- icons ----------
const markSvg = (size, pad = 0) => {
  const s = size;
  const inner = s - pad * 2;
  const k = inner / 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${s * 0.22}" fill="${FOG}"/>
  <g transform="translate(${pad} ${pad}) scale(${k})">
    <rect x="4.5" y="4.5" width="23" height="23" rx="9" fill="none" stroke="${INK}" stroke-width="3"/>
    <circle cx="27.5" cy="13" r="4.2" fill="${SIGNAL}"/>
  </g>
</svg>`;
};
writeFileSync(
  join(STATIC, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${FOG}"/><rect x="6" y="6" width="19" height="19" rx="7" fill="none" stroke="${INK}" stroke-width="2.6"/><circle cx="25" cy="14" r="3.6" fill="${SIGNAL}"/></svg>\n`
);
for (const [name, size, pad] of [["favicon-32.png", 32, 2], ["apple-touch-icon.png", 180, 26], ["icon-192.png", 192, 28], ["icon-512.png", 512, 74]]) {
  await sharp(Buffer.from(markSvg(size, pad))).png().toFile(join(STATIC, name));
}

// ---------- social images ----------
function wrap(text, maxChars, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,.;:–-]*\S*$/, "") + "…";
  }
  return lines;
}

function ogSvg({ title, kicker }) {
  const size = title.length <= 36 ? 78 : title.length <= 64 ? 64 : 54;
  const maxChars = Math.floor(700 / (size * 0.56));
  const lines = wrap(title, maxChars, 5);
  const lh = size * 1.06;
  const blockH = lines.length * lh;
  const startY = 315 - blockH / 2 + size * 0.82;
  const text = lines.map((l, i) => `<text x="72" y="${(startY + i * lh).toFixed(1)}" font-family="${DISPLAY}" font-weight="800" font-size="${size}" letter-spacing="${(-size * 0.035).toFixed(2)}" fill="#fff">${escapeXml(l)}</text>`).join("\n");
  // loop motif on the right
  const cx = 985, cy = 300, half = 130, r = 52;
  const x0 = cx - half, y0 = cy - half, d = half * 2;
  const path = `M${cx} ${y0}H${x0 + d - r}A${r} ${r} 0 0 1 ${x0 + d} ${y0 + r}V${y0 + d - r}A${r} ${r} 0 0 1 ${x0 + d - r} ${y0 + d}H${x0 + r}A${r} ${r} 0 0 1 ${x0} ${y0 + d - r}V${y0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${INK}"/>
  <path d="${path}" fill="none" stroke="#fff" stroke-opacity="0.9" stroke-width="7"/>
  <circle cx="${x0 + d}" cy="${cy - 60}" r="17" fill="${SIGNAL}"/>
  <text x="72" y="96" font-family="${DISPLAY}" font-weight="800" font-size="34" letter-spacing="-1.2" fill="#fff">${escapeXml(site.name)}</text>
  <rect x="72" y="110" width="44" height="5" rx="2.5" fill="${SIGNAL}"/>
  ${text}
  <text x="72" y="578" font-family="${DISPLAY}" font-weight="600" font-size="26" fill="#fff" fill-opacity="0.72">${escapeXml(kicker)}</text>
</svg>`;
}

async function og(file, opts) {
  await sharp(Buffer.from(ogSvg(opts))).png({ compressionLevel: 9 }).toFile(join(STATIC, "og", file));
}

await og("default.png", { title: site.tagline, kicker: new URL(site.url).hostname });
const dir = join(ROOT, "content/posts");
let n = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".md"))) {
  const { data } = parseFrontmatter(readFileSync(join(dir, f), "utf8"), f);
  const cat = site.categories.find((c) => c.slug === data.category);
  await og(`${f.replace(/\.md$/, "")}.png`, { title: data.title, kicker: `${cat ? cat.name + " on " : ""}${new URL(site.url).hostname}` });
  n++;
}
console.log(`Wrote icons, default share image and ${n} post image${n === 1 ? "" : "s"} to static/`);
