#!/usr/bin/env node
// Loopwise static site generator.  Usage: node build.mjs [--drafts] [--future]
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import site from "./site.config.mjs";
import { parseFrontmatter } from "./lib/frontmatter.mjs";
import { renderMarkdown } from "./lib/markdown.mjs";
import { escapeXml, isoDate, parseDate, slugify, plural } from "./lib/util.mjs";
import * as T from "./lib/templates.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : join(ROOT, "dist");
const args = new Set(process.argv.slice(2));
const warnings = [];
const warn = (msg) => warnings.push(msg);
const host = new URL(site.url).hostname;

const read = (p) => readFileSync(join(ROOT, p), "utf8");
function write(rel, content) {
  const file = join(DIST, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
const writePage = (path, html) => write(path.endsWith("/") ? `${path.slice(1)}index.html` : path.slice(1), html);
const hash = (s) => createHash("sha1").update(s).digest("hex").slice(0, 8);

// ---------------------------------------------------------------------------
// 1. Clean + static assets
// ---------------------------------------------------------------------------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const css = read("static/css/style.css");
const js = read("static/js/site.js");
const cssName = `style.${hash(css)}.css`;
const jsName = `site.${hash(js)}.js`;
write(`assets/${cssName}`, css);
write(`assets/${jsName}`, js);
cpSync(join(ROOT, "static/fonts"), join(DIST, "assets/fonts"), { recursive: true });
for (const entry of readdirSync(join(ROOT, "static"))) {
  if (["css", "js", "fonts"].includes(entry)) continue;
  cpSync(join(ROOT, "static", entry), join(DIST, entry), { recursive: true });
}
T.state.assets = { css: `/assets/${cssName}`, js: `/assets/${jsName}` };
T.state.buildYear = new Date().getFullYear();

// ---------------------------------------------------------------------------
// 2. Load data
// ---------------------------------------------------------------------------
const tools = JSON.parse(read("data/tools.json"));
for (const t of tools) {
  for (const k of ["slug", "name", "kind", "url", "tagline", "summary", "goodFor", "skipIf", "pricing"]) {
    if (!t[k]) throw new Error(`data/tools.json: "${t.slug || t.name}" is missing "${k}"`);
  }
}
const missingAffiliate = tools.filter((t) => !t.affiliateUrl).map((t) => t.name);
if (missingAffiliate.length) warn(`No affiliateUrl yet for: ${missingAffiliate.join(", ")}. Their /go/ links send visitors to the plain site URL until you add one in data/tools.json.`);
T.state.tools = tools;

// Posts dated "today" anywhere on Earth are published: use the date in the furthest-ahead time zone (UTC+14).
const today = new Date(Date.now() + 14 * 3600 * 1000).toISOString().slice(0, 10);
const categorySlugs = new Set(site.categories.map((c) => c.slug));

function loadPosts() {
  const dir = join(ROOT, "content/posts");
  const posts = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const slug = file.replace(/\.md$/, "");
    const { data, body } = parseFrontmatter(read(`content/posts/${file}`), file);
    for (const k of ["title", "description", "date", "category"]) {
      if (!data[k]) throw new Error(`content/posts/${file}: missing "${k}" in front matter`);
    }
    if (!categorySlugs.has(data.category)) {
      throw new Error(`content/posts/${file}: category "${data.category}" must be one of: ${[...categorySlugs].join(", ")}`);
    }
    if (data.draft && !args.has("--drafts")) continue;
    if (isoDate(data.date) > today && !args.has("--future")) {
      warn(`Scheduled: "${data.title}" (${isoDate(data.date)}) is hidden until its date. Rebuild on/after that day.`);
      continue;
    }
    const { html, toc, words } = renderMarkdown(body, { siteHost: host });
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
    const readingTime = Math.max(1, Math.ceil(words / site.wordsPerMinute));
    const hasOg = existsSync(join(ROOT, "static/og", `${slug}.png`));
    if (data.description.length < 70 || data.description.length > 165) warn(`${file}: description is ${data.description.length} chars (aim for 70-160).`);
    if (data.title.length > 62) warn(`${file}: title is ${data.title.length} chars; Google may cut it in results.`);
    if (words < 800) warn(`${file}: only ${words} words. Thin posts hurt AdSense approval.`);
    posts.push({
      ...data,
      slug,
      path: `/blog/${slug}/`,
      tags,
      html,
      toc,
      words,
      readingTime,
      ogImage: hasOg ? `/og/${slug}.png` : "/og/default.png",
    });
  }
  posts.sort((a, b) => (isoDate(b.date) === isoDate(a.date) ? a.title.localeCompare(b.title) : isoDate(b.date).localeCompare(isoDate(a.date))));
  return posts;
}

const posts = loadPosts();
T.state.posts = posts;

// ---------------------------------------------------------------------------
// 3. Static markdown pages
// ---------------------------------------------------------------------------
const vars = {
  "site.name": site.name,
  "site.url": site.url,
  "site.host": host,
  "site.email": site.contactEmail,
  "author.name": site.author.name,
  "author.role": site.author.role,
  "author.bio": site.author.bio,
  year: String(new Date().getFullYear()),
};
const fill = (s) => s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));

const staticPages = [];
for (const file of readdirSync(join(ROOT, "content/pages")).filter((f) => f.endsWith(".md"))) {
  const slug = file.replace(/\.md$/, "");
  const { data, body } = parseFrontmatter(read(`content/pages/${file}`), file);
  const { html } = renderMarkdown(fill(body), { siteHost: host });
  staticPages.push({
    slug,
    path: `/${slug}/`,
    title: data.title || slug,
    description: data.description || site.description,
    lede: data.lede ? fill(data.lede) : "",
    updated: data.updated || "",
    noindex: Boolean(data.noindex),
    cta: Boolean(data.cta),
    html,
  });
}

// ---------------------------------------------------------------------------
// 4. Render everything
// ---------------------------------------------------------------------------
const sitemap = []; // {path, lastmod}

writePage("/", T.homePage());
sitemap.push({ path: "/" });

writePage("/blog/", T.blogIndexPage());
sitemap.push({ path: "/blog/", lastmod: posts[0] && isoDate(posts[0].updated || posts[0].date) });

for (const post of posts) {
  const score = (o) => o.tags.filter((t) => post.tags.includes(t)).length * 2 + (o.category === post.category ? 1 : 0);
  const related = posts
    .filter((o) => o.slug !== post.slug)
    .map((o) => ({ o, s: score(o) }))
    .sort((a, b) => b.s - a.s || isoDate(b.o.date).localeCompare(isoDate(a.o.date)))
    .slice(0, 3)
    .map((x) => x.o);
  writePage(post.path, T.postPage(post, related));
  sitemap.push({ path: post.path, lastmod: isoDate(post.updated || post.date) });
}

for (const cat of site.categories) {
  const inCat = posts.filter((p) => p.category === cat.slug);
  writePage(`/category/${cat.slug}/`, T.categoryPage(cat));
  if (inCat.length) sitemap.push({ path: `/category/${cat.slug}/`, lastmod: isoDate(inCat[0].updated || inCat[0].date) });
}

const tagMap = new Map();
for (const p of posts) for (const t of p.tags) tagMap.set(slugify(t), { name: t, slug: slugify(t), posts: [...(tagMap.get(slugify(t))?.posts || []), p] });
for (const tag of tagMap.values()) {
  writePage(`/tags/${tag.slug}/`, T.tagPage(tag, tag.posts));
  if (tag.posts.length >= 3) sitemap.push({ path: `/tags/${tag.slug}/`, lastmod: isoDate(tag.posts[0].updated || tag.posts[0].date) });
}

writePage("/tools/", T.toolsIndexPage());
sitemap.push({ path: "/tools/" });
let redirects = "";
for (const tool of tools) {
  writePage(`/tools/${tool.slug}/`, T.toolPage(tool));
  sitemap.push({ path: `/tools/${tool.slug}/` });
  writePage(`/go/${tool.slug}/`, T.goPage(tool));
  redirects += `/go/${tool.slug}  ${tool.affiliateUrl || tool.url}  302\n`;
}
write("_redirects", redirects);

writePage("/newsletter/", T.newsletterPage());
sitemap.push({ path: "/newsletter/" });
writePage("/thanks/", T.thanksPage());
writePage("/confirmed/", T.confirmedPage());
write("404.html", T.notFoundPage());

for (const pg of staticPages) {
  writePage(pg.path, T.prosePage(pg));
  if (!pg.noindex) sitemap.push({ path: pg.path, lastmod: pg.updated ? isoDate(pg.updated) : undefined });
}

// ---------------------------------------------------------------------------
// 5. Feeds, sitemap, robots, search index, manifest
// ---------------------------------------------------------------------------
const abs = (p) => `${site.url}${p}`;
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap
  .map((u) => `  <url><loc>${escapeXml(abs(u.path))}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`)
  .join("\n")}
</urlset>
`
);

write(
  "robots.txt",
  `User-agent: *
Allow: /
Disallow: /go/
Disallow: /thanks/
Disallow: /confirmed/
Disallow: /api/

Sitemap: ${abs("/sitemap.xml")}
`
);

if (site.adsense.publisherId) {
  write("ads.txt", `google.com, ${site.adsense.publisherId}, DIRECT, f08c47fec0942fa0\n`);
} else {
  warn("ADSENSE_CLIENT is not set, so ads.txt and ad slots are skipped. Set it after AdSense approves the site.");
}

const rfc822 = (d) => parseDate(d).toUTCString();
write(
  "feed.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(site.name)}</title>
  <link>${site.url}</link>
  <description>${escapeXml(site.description)}</description>
  <language>${site.language}</language>
  <atom:link href="${abs("/feed.xml")}" rel="self" type="application/rss+xml"/>
${posts
  .slice(0, site.postsPerFeed)
  .map(
    (p) => `  <item>
    <title>${escapeXml(p.title)}</title>
    <link>${abs(p.path)}</link>
    <guid isPermaLink="true">${abs(p.path)}</guid>
    <pubDate>${rfc822(p.date)}</pubDate>
    <description>${escapeXml(p.description)}</description>
${p.tags.map((t) => `    <category>${escapeXml(t)}</category>`).join("\n")}
  </item>`
  )
  .join("\n")}
</channel>
</rss>
`
);

write(
  "search-index.json",
  JSON.stringify(
    posts.map((p) => ({
      t: p.title,
      d: p.description,
      u: p.path,
      c: site.categories.find((c) => c.slug === p.category)?.name || "",
      k: p.tags.join(" "),
    }))
  )
);

write(
  "manifest.webmanifest",
  JSON.stringify(
    {
      name: site.name,
      short_name: site.name,
      description: site.description,
      start_url: "/",
      display: "standalone",
      background_color: "#F1F4F9",
      theme_color: "#2540FF",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    null,
    2
  )
);

// ---------------------------------------------------------------------------
// 6. Report
// ---------------------------------------------------------------------------
if (!site.analytics.ga4) warn("GA_MEASUREMENT_ID is not set, so analytics is off.");
if (!process.env.SITE_URL) warn(`SITE_URL is not set. Using the placeholder ${site.url}; canonical URLs and the sitemap will be wrong until you set it.`);
if (!process.env.AUTHOR_NAME) warn(`AUTHOR_NAME is not set. Posts are bylined "${site.author.name}"; use your real name before applying to AdSense.`);
if (!process.env.CONTACT_EMAIL) warn(`CONTACT_EMAIL is not set. Using ${site.contactEmail}; make sure that mailbox exists.`);

const pageCount = sitemap.length + tools.length /* go pages */ + 3;
console.log(`Built ${plural(posts.length, "article")}, ${plural(tools.length, "tool profile")}, ${plural(staticPages.length, "static page")} -> ${relative(process.cwd(), DIST) || "dist"}/ (~${pageCount} HTML pages)`);
if (warnings.length) {
  console.log(`\n${warnings.length} note${warnings.length === 1 ? "" : "s"}:`);
  for (const w of warnings) console.log(`  - ${w}`);
}
