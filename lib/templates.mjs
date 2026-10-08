import site from "../site.config.mjs";
import { escapeHtml as e, formatDate, isoDate, absUrl, plural, truncate } from "./util.mjs";

// ---------------------------------------------------------------------------
// Shared state set by build.mjs before rendering
// ---------------------------------------------------------------------------
export const state = {
  assets: { css: "/assets/style.css", js: "/assets/site.js" },
  posts: [],
  tools: [],
  buildYear: new Date().getFullYear(),
  formCounter: 0,
  hasAffiliates: false,
};

const adsOn = (slot) => Boolean(site.adsense.client && site.adsense.slots[slot]);

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
export const logoMark = `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect x="4.5" y="4.5" width="23" height="23" rx="9" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="27.5" cy="13" r="4.2" fill="var(--signal)"/></svg>`;

const icon = {
  search: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  theme: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 010 16z" fill="currentColor"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 8h16M4 16h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
};

export function breadcrumbs(items) {
  // items: [{label, href?}] – last item is the current page
  const lis = items
    .map((it, i) =>
      i === items.length - 1
        ? `<li aria-current="page">${e(it.label)}</li>`
        : `<li><a href="${e(it.href)}">${e(it.label)}</a></li>`
    )
    .join("");
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${lis}</ol></nav>`;
}

export function breadcrumbLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.label,
      item: absUrl(site, it.href || it.path || "/"),
    })),
  };
}

export function subscribeForm({ source = "site", button = "Get the weekly workflow", note = site.newsletter.promise, id } = {}) {
  const n = ++state.formCounter;
  const fid = id || `email-${n}`;
  return `<form class="subscribe" method="post" action="${site.newsletter.endpoint}" data-subscribe>
  <div class="subscribe-row">
    <label class="sr-only" for="${fid}">Email address</label>
    <input id="${fid}" type="email" name="email" placeholder="you@example.com" autocomplete="email" required>
    <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <input type="hidden" name="source" value="${e(source)}">
    <button class="btn btn-primary" type="submit">${e(button)}</button>
  </div>
  ${note ? `<p class="form-note">${e(note)}</p>` : ""}
  <p class="form-status" role="status" aria-live="polite"></p>
</form>`;
}

export function adSlot(name) {
  if (!adsOn(name)) return "";
  return `<aside class="ad ad-${name}" data-ad-slot="${e(site.adsense.slots[name])}" aria-label="Advertisement"><span class="ad-label">Advertisement</span></aside>`;
}

export function postRow(post, { showCategory = true } = {}) {
  const cat = site.categories.find((c) => c.slug === post.category);
  const search = `${post.title} ${post.description} ${post.tags.join(" ")}`.toLowerCase();
  return `<li class="row" data-search="${e(search)}">
  <a class="row-link" href="${post.path}">
    <time class="row-date" datetime="${isoDate(post.date)}">${formatDate(post.date)}</time>
    <span class="row-main">
      <span class="row-title">${e(post.title)}</span>
      <span class="row-desc">${e(post.description)}</span>
    </span>
    <span class="row-meta">
      <span>${post.readingTime} min read</span>
      ${showCategory && cat ? `<span class="row-cat">${e(cat.name)}</span>` : ""}
    </span>
  </a>
</li>`;
}

export const postList = (posts, opts) => `<ol class="rows">${posts.map((p) => postRow(p, opts)).join("")}</ol>`;

const visitLink = (tool, cls) =>
  tool.affiliateUrl
    ? `<a class="btn ${cls}" href="/go/${tool.slug}/" rel="sponsored nofollow noopener" data-tool="${tool.slug}">Visit ${e(tool.name)}</a>`
    : `<a class="btn ${cls}" href="${e(tool.url)}" target="_blank" rel="noopener noreferrer">Visit ${e(tool.name)}</a>`;

export function toolRow(tool) {
  return `<li class="tool-row">
  <div class="tool-row-main">
    <h3><a href="/tools/${tool.slug}/">${e(tool.name)}</a></h3>
    <p class="tool-kind">${e(tool.kind)}</p>
    <p>${e(tool.tagline)}</p>
  </div>
  <div class="tool-row-actions">
    <a class="btn btn-quiet" href="/tools/${tool.slug}/">Profile</a>
    ${visitLink(tool, "btn-outline")}
  </div>
</li>`;
}

// ---------------------------------------------------------------------------
// Header / footer
// ---------------------------------------------------------------------------
function header(currentPath) {
  const links = site.nav
    .map((n) => {
      const active = n.href === "/" ? currentPath === "/" : currentPath.startsWith(n.href);
      return `<li><a href="${n.href}"${active ? ' aria-current="page"' : ""}>${e(n.label)}</a></li>`;
    })
    .join("");
  return `<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="/" aria-label="${e(site.name)} home">${logoMark}<span>${e(site.name)}</span></a>
    <nav class="nav" id="site-nav" aria-label="Main">
      <ul>${links}</ul>
    </nav>
    <div class="bar-actions">
      <button class="icon-btn" type="button" data-search-open aria-label="Search articles">${icon.search}</button>
      <button class="icon-btn" type="button" data-theme-toggle aria-label="Switch colour theme">${icon.theme}</button>
      <a class="btn btn-primary btn-small bar-cta" href="/newsletter/">Subscribe</a>
      <button class="icon-btn nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav" aria-label="Menu">${icon.menu}</button>
    </div>
  </div>
</header>
<dialog class="search" data-search-dialog aria-label="Search articles">
  <form method="dialog" class="search-head">
    <input type="search" data-search-input placeholder="Search articles" autocomplete="off" aria-label="Search articles">
    <button class="btn btn-quiet btn-small" value="close">Close</button>
  </form>
  <ul class="search-results" data-search-results></ul>
</dialog>`;
}

function footer() {
  const toolLinks = state.tools
    .slice(0, 5)
    .map((t) => `<li><a href="/tools/${t.slug}/">${e(t.name)}</a></li>`)
    .join("");
  const catLinks = site.categories.map((c) => `<li><a href="/category/${c.slug}/">${e(c.name)}</a></li>`).join("");
  const support = site.support.kofi
    ? `<li><a href="${e(site.support.kofi)}" rel="noopener" target="_blank">Support on Ko-fi</a></li>`
    : site.support.patreon
      ? `<li><a href="${e(site.support.patreon)}" rel="noopener" target="_blank">Support on Patreon</a></li>`
      : "";
  return `<footer class="site-footer">
  <div class="wrap foot-grid">
    <div class="foot-brand">
      <a class="brand" href="/">${logoMark}<span>${e(site.name)}</span></a>
      <p>${e(site.description)}</p>
    </div>
    <div>
      <h2 class="foot-h">Read</h2>
      <ul><li><a href="/blog/">All articles</a></li>${catLinks}<li><a href="/resources/">Starter kit</a></li><li><a href="/feed.xml">RSS feed</a></li></ul>
    </div>
    <div>
      <h2 class="foot-h">Tools</h2>
      <ul>${toolLinks}<li><a href="/tools/">All tools</a></li></ul>
    </div>
    <div>
      <h2 class="foot-h">${e(site.name)}</h2>
      <ul>
        <li><a href="/about/">About</a></li>
        <li><a href="/contact/">Contact</a></li>
        <li><a href="/advertise/">Advertise</a></li>
        ${support}
        <li><a href="/privacy-policy/">Privacy policy</a></li>
        <li><a href="/terms/">Terms</a></li>
        <li><a href="/affiliate-disclosure/">Affiliate disclosure</a></li>
        <li><button class="linklike" type="button" data-consent-open hidden>Cookie settings</button></li>
      </ul>
    </div>
  </div>
  <div class="wrap foot-base">
    <p>&copy; ${state.buildYear} ${e(site.name)}.${state.hasAffiliates ? " Some links on this site are affiliate links, so we may earn a commission if you buy through them." : ""}</p>
  </div>
</footer>`;
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------
const THEME_BOOT = `(function(){try{var d=document.documentElement;d.classList.replace('no-js','js');var t=localStorage.getItem('lw-theme');if(t==='dark'||t==='light')d.setAttribute('data-theme',t);if(localStorage.getItem('lw-consent')==='granted')d.classList.add('consent-granted')}catch(e){document.documentElement.classList.replace('no-js','js')}})()`;

export function page({
  title,
  description,
  path = "/",
  ogImage = "/og/default.png",
  ogType = "website",
  jsonLd = [],
  noindex = false,
  body,
  bodyClass = "",
  headExtra = "",
  fullTitle,
}) {
  const url = absUrl(site, path);
  const t = fullTitle || (path === "/" ? `${site.name}: ${site.tagline}` : `${title} | ${site.name}`);
  const desc = truncate(description || site.description, 160);
  const img = absUrl(site, ogImage);
  const ld = jsonLd.length
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd).replace(/</g, "\\u003c")}</script>`
    : "";
  const cfg = {
    ga4: site.analytics.ga4,
    adsenseClient: site.adsense.client,
  };
  return `<!doctype html>
<html lang="${site.language}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(t)}</title>
<meta name="description" content="${e(desc)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
<meta name="theme-color" content="#F1F4F9" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0A1230" media="(prefers-color-scheme: dark)">
<meta property="og:site_name" content="${e(site.name)}">
<meta property="og:locale" content="${site.locale}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${e(title && path !== "/" ? title : t)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title && path !== "/" ? title : t)}">
<meta name="twitter:description" content="${e(desc)}">
<meta name="twitter:image" content="${img}">
${site.author.twitter ? `<meta name="twitter:creator" content="@${e(site.author.twitter)}">` : ""}
${site.analytics.searchConsoleVerification ? `<meta name="google-site-verification" content="${e(site.analytics.searchConsoleVerification)}">` : ""}
${site.analytics.bingVerification ? `<meta name="msvalidate.01" content="${e(site.analytics.bingVerification)}">` : ""}
<link rel="alternate" type="application/rss+xml" title="${e(site.name)}" href="/feed.xml">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/assets/fonts/display-800.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="/assets/fonts/serif-400.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="${state.assets.css}">
<script>${THEME_BOOT}</script>
${ld}
${headExtra}
</head>
<body class="${e(bodyClass)}">
<a class="skip" href="#main">Skip to content</a>
${header(path)}
<main id="main">
${body}
</main>
${footer()}
<div class="consent" data-consent hidden role="dialog" aria-labelledby="consent-title" aria-modal="false">
  <p id="consent-title" class="consent-title">Cookies</p>
  <p>${e(site.name)} uses cookies for analytics and for ads that keep the articles free. Accepting is optional.</p>
  <div class="consent-actions">
    <button class="btn btn-primary btn-small" type="button" data-consent-accept>Accept</button>
    <button class="btn btn-outline btn-small" type="button" data-consent-reject>Reject</button>
    <a href="/privacy-policy/">Privacy policy</a>
  </div>
</div>
<script type="application/json" id="lw-config">${JSON.stringify(cfg)}</script>
<script src="${state.assets.js}" defer></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------
function loopHero(posts) {
  const latest = posts[0];
  const counts = Object.fromEntries(site.categories.map((c) => [c.slug, posts.filter((p) => p.category === c.slug).length]));
  const stop = (pos, cat) =>
    `<a class="stop stop-${pos}" href="/category/${cat.slug}/" title="${e(cat.blurb)}"><strong>${e(cat.name)}</strong><small>${plural(counts[cat.slug], "article")}</small></a>`;
  const [build, compare, automate, ship] = site.categories;
  const chevron = (x, y, a) => `<path d="M-6 -6L3 0L-6 6" transform="translate(${x} ${y}) rotate(${a})" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<div class="loop">
  <svg class="loop-track" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
    <rect x="40" y="40" width="320" height="320" rx="80" fill="none" stroke="currentColor" stroke-width="3"/>
    ${chevron(63.4, 63.4, -45)}${chevron(336.6, 63.4, 45)}${chevron(336.6, 336.6, 135)}${chevron(63.4, 336.6, -135)}
    <circle r="9" fill="var(--signal)"><animateMotion dur="18s" repeatCount="indefinite" path="M200 40H280A80 80 0 0 1 360 120V280A80 80 0 0 1 280 360H120A80 80 0 0 1 40 280V120A80 80 0 0 1 120 40Z"/></circle>
  </svg>
  ${stop("top", build)}${stop("right", compare)}${stop("bottom", automate)}${stop("left", ship)}
  <div class="loop-core">
    ${
      latest
        ? `<time datetime="${isoDate(latest.date)}">${formatDate(latest.date)}</time>
    <a class="loop-latest" href="${latest.path}">${e(latest.title)}</a>
    <span class="loop-read">${latest.readingTime} min read</span>`
        : `<span class="loop-latest">First articles are on the way.</span>`
    }
  </div>
</div>`;
}

export function homePage() {
  const posts = state.posts;
  const latest = posts.slice(0, 6);
  const tools = state.tools.slice(0, 4);
  const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <h1>${e(site.tagline)}</h1>
      <p class="lede">${e(site.name)} tests AI tools and automation workflows, then publishes what works along with the code to run it today.</p>
      ${subscribeForm({ source: "home-hero" })}
    </div>
    ${loopHero(posts)}
  </div>
</section>

<section class="block">
  <div class="wrap">
    <div class="block-head">
      <h2>Latest articles</h2>
      <a href="/blog/">All articles</a>
    </div>
    ${postList(latest)}
  </div>
</section>

<section class="block block-tools">
  <div class="wrap">
    <div class="block-head">
      <h2>Tools worth knowing</h2>
      <a href="/tools/">All tools</a>
    </div>
    <ul class="tool-rows">${tools.map(toolRow).join("")}</ul>
    ${state.hasAffiliates ? `<p class="fine">Some links are affiliate links. <a href="/affiliate-disclosure/">How that works</a>.</p>` : ""}
  </div>
</section>

<section class="band">
  <div class="wrap band-grid">
    <div>
      <h2>One tested workflow a week</h2>
      <p>Each issue covers a single automation: what it does, the code or setup, and what it cost to run.</p>
    </div>
    ${subscribeForm({ source: "home-band", button: "Subscribe" })}
  </div>
</section>`;
  return page({
    title: site.name,
    description: site.description,
    path: "/",
    body,
    bodyClass: "home",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: site.name,
        url: site.url,
        description: site.description,
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${site.url}/blog/?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: site.name,
        url: site.url,
        logo: absUrl(site, "/apple-touch-icon.png"),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Listing pages
// ---------------------------------------------------------------------------
export function blogIndexPage() {
  const body = `
<div class="wrap page-head">
  ${breadcrumbs([{ label: "Home", href: "/" }, { label: "Articles" }])}
  <h1>Articles</h1>
  <p class="lede">Tutorials, comparisons and automation guides. Every one ships with code or a setup you can reproduce.</p>
  <div class="filters">
    <ul class="chips" aria-label="Categories">
      <li><a href="/blog/" aria-current="page">All</a></li>
      ${site.categories.map((c) => `<li><a href="/category/${c.slug}/">${e(c.name)}</a></li>`).join("")}
    </ul>
    <label class="sr-only" for="filter">Filter articles</label>
    <input id="filter" type="search" placeholder="Filter by keyword" data-filter autocomplete="off">
  </div>
</div>
<div class="wrap">
  ${postList(state.posts)}
  <p class="empty" data-filter-empty hidden>No articles match that. Try a shorter keyword.</p>
</div>`;
  return page({
    title: "Articles",
    description: "Tutorials, tool comparisons and automation guides with working code.",
    path: "/blog/",
    body,
    jsonLd: [breadcrumbLd([{ label: "Home", href: "/" }, { label: "Articles", href: "/blog/" }])],
  });
}

export function categoryPage(cat) {
  const posts = state.posts.filter((p) => p.category === cat.slug);
  const crumbs = [{ label: "Home", href: "/" }, { label: "Articles", href: "/blog/" }, { label: cat.name, href: `/category/${cat.slug}/` }];
  const body = `
<div class="wrap page-head">
  ${breadcrumbs(crumbs)}
  <h1>${e(cat.name)}</h1>
  <p class="lede">${e(cat.blurb)}</p>
</div>
<div class="wrap">
  ${
    posts.length
      ? postList(posts, { showCategory: false })
      : `<div class="empty-state"><p>No articles in ${e(cat.name)} yet. New ones land every week.</p>${subscribeForm({ source: `category-${cat.slug}` })}</div>`
  }
</div>`;
  return page({
    title: `${cat.name}: ${site.name} articles`,
    description: cat.blurb,
    path: `/category/${cat.slug}/`,
    body,
    noindex: posts.length === 0,
    jsonLd: [breadcrumbLd(crumbs)],
  });
}

export function tagPage(tag, posts) {
  const crumbs = [{ label: "Home", href: "/" }, { label: "Articles", href: "/blog/" }, { label: tag.name, href: `/tags/${tag.slug}/` }];
  const body = `
<div class="wrap page-head">
  ${breadcrumbs(crumbs)}
  <h1>${e(tag.name)}</h1>
  <p class="lede">${plural(posts.length, "article")} tagged ${e(tag.name)}.</p>
</div>
<div class="wrap">${postList(posts)}</div>`;
  return page({
    title: `${tag.name} articles`,
    description: `Articles about ${tag.name} on ${site.name}.`,
    path: `/tags/${tag.slug}/`,
    body,
    noindex: posts.length < 3,
    jsonLd: [breadcrumbLd(crumbs)],
  });
}

// ---------------------------------------------------------------------------
// Post page
// ---------------------------------------------------------------------------
function tocHtml(toc) {
  if (toc.length < 3) return "";
  let html = "";
  let open = false;
  for (const item of toc) {
    if (item.depth === 2) {
      if (open) html += "</ul></li>";
      html += `<li><a href="#${item.id}">${e(item.text)}</a>`;
      html += "<ul>";
      open = true;
    } else {
      html += `<li><a href="#${item.id}">${e(item.text)}</a></li>`;
    }
  }
  if (open) html += "</ul></li>";
  return html.replace(/<ul><\/ul>/g, "");
}

function injectAds(html) {
  let out = html;
  // top: before the first H2 (after the intro)
  if (adsOn("top")) out = out.replace(/<h2 /, `${adSlot("top")}<h2 `);
  // middle: before the 3rd H2, only on longer articles
  if (adsOn("middle")) {
    let n = 0;
    out = out.replace(/<h2 /g, (m) => (++n === 3 ? `${adSlot("middle")}${m}` : m));
  }
  return out;
}

function authorBox() {
  const a = site.author;
  const links = [
    a.twitter && `<a href="https://x.com/${e(a.twitter)}" rel="me noopener" target="_blank">X</a>`,
    a.github && `<a href="https://github.com/${e(a.github)}" rel="me noopener" target="_blank">GitHub</a>`,
    a.linkedin && `<a href="${e(a.linkedin)}" rel="me noopener" target="_blank">LinkedIn</a>`,
  ].filter(Boolean);
  return `<aside class="author" aria-label="About the author">
  <span class="avatar" aria-hidden="true">${e(a.name.trim().charAt(0).toUpperCase())}</span>
  <div>
    <p class="author-name"><a href="/about/">${e(a.name)}</a></p>
    <p class="author-role">${e(a.role)}</p>
    <p>${e(a.bio)}</p>
    ${links.length ? `<p class="author-links">${links.join("")}</p>` : ""}
  </div>
</aside>`;
}

function shareLinks(post) {
  const u = encodeURIComponent(absUrl(site, post.path));
  const t = encodeURIComponent(post.title);
  return `<div class="share" aria-label="Share this article">
  <span class="share-label">Share</span>
  <a href="https://x.com/intent/post?text=${t}&amp;url=${u}" target="_blank" rel="noopener noreferrer">X</a>
  <a href="https://www.linkedin.com/sharing/share-offsite/?url=${u}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
  <a href="https://news.ycombinator.com/submitlink?u=${u}&amp;t=${t}" target="_blank" rel="noopener noreferrer">Hacker News</a>
  <button type="button" class="linklike" data-copy-link="${e(absUrl(site, post.path))}">Copy link</button>
</div>`;
}

export function postPage(post, related) {
  const cat = site.categories.find((c) => c.slug === post.category);
  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Articles", href: "/blog/" },
    ...(cat ? [{ label: cat.name, href: `/category/${cat.slug}/` }] : []),
    { label: post.title, href: post.path },
  ];
  const toc = tocHtml(post.toc);
  const updated = post.updated && isoDate(post.updated) !== isoDate(post.date);
  const hasAffiliate = /href="\/go\//.test(post.html);
  const articleHtml = injectAds(post.html);

  const body = `
<div class="wrap post-wrap">
  <article class="post" itemscope itemtype="https://schema.org/BlogPosting">
    <header class="post-head">
      ${breadcrumbs(crumbs.map((c, i) => (i === crumbs.length - 1 ? { label: "This article" } : c)))}
      <h1 itemprop="headline">${e(post.title)}</h1>
      <p class="lede" itemprop="description">${e(post.description)}</p>
      <p class="byline">
        <span>By <a href="/about/" rel="author">${e(site.author.name)}</a></span>
        <span><time datetime="${isoDate(post.date)}" itemprop="datePublished">${formatDate(post.date)}</time></span>
        ${updated ? `<span>Updated <time datetime="${isoDate(post.updated)}" itemprop="dateModified">${formatDate(post.updated)}</time></span>` : ""}
        <span>${post.readingTime} min read</span>
      </p>
      ${hasAffiliate ? `<p class="disclosure">This article contains affiliate links. If you buy through them we may earn a commission at no extra cost to you. <a href="/affiliate-disclosure/">How we handle this</a>.</p>` : ""}
    </header>
    ${toc ? `<details class="toc-mobile"><summary>In this article</summary><ul>${toc}</ul></details>` : ""}
    <div class="prose" itemprop="articleBody">
      ${articleHtml}
    </div>
    ${shareLinks(post)}
    ${adSlot("end")}
    <section class="post-cta" aria-labelledby="cta-h">
      <h2 id="cta-h">Get the next workflow by email</h2>
      <p>${e(site.newsletter.promise)}</p>
      ${subscribeForm({ source: `post-${post.slug}`, button: "Subscribe", note: "" })}
    </section>
    ${authorBox()}
  </article>
  <aside class="sidebar" aria-label="Sidebar">
    ${toc ? `<nav class="toc" aria-label="Table of contents"><p class="toc-title">On this page</p><ul>${toc}</ul></nav>` : ""}
    <div class="side-box">
      <p class="side-title">Weekly workflow</p>
      <p>${e(site.newsletter.promise)}</p>
      ${subscribeForm({ source: `sidebar-${post.slug}`, button: "Subscribe", note: "" })}
    </div>
    ${
      site.support.kofi
        ? `<div class="side-box"><p class="side-title">Keep it free</p><p>If this saved you time, you can support the site.</p><a class="btn btn-outline btn-small" href="${e(site.support.kofi)}" target="_blank" rel="noopener">Support on Ko-fi</a></div>`
        : ""
    }
  </aside>
</div>
${
  related.length
    ? `<section class="block"><div class="wrap"><div class="block-head"><h2>Keep reading</h2></div>${postList(related)}</div></section>`
    : ""
}`;

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      image: [absUrl(site, post.ogImage)],
      datePublished: isoDate(post.date),
      dateModified: isoDate(post.updated || post.date),
      author: { "@type": "Person", name: site.author.name, url: absUrl(site, "/about/") },
      publisher: {
        "@type": "Organization",
        name: site.name,
        logo: { "@type": "ImageObject", url: absUrl(site, "/apple-touch-icon.png") },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": absUrl(site, post.path) },
      keywords: post.tags.join(", "),
      articleSection: cat ? cat.name : undefined,
      wordCount: post.words,
    },
    breadcrumbLd(crumbs),
  ];

  return page({
    title: post.title,
    description: post.description,
    path: post.path,
    ogImage: post.ogImage,
    ogType: "article",
    body,
    bodyClass: "post-page",
    jsonLd: ld,
    headExtra: `<meta property="article:published_time" content="${isoDate(post.date)}">${updated ? `<meta property="article:modified_time" content="${isoDate(post.updated)}">` : ""}${post.tags.map((t) => `<meta property="article:tag" content="${e(t)}">`).join("")}`,
  });
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
export function toolsIndexPage() {
  const crumbs = [{ label: "Home", href: "/" }, { label: "Tools", href: "/tools/" }];
  const rows = state.tools
    .map((t) => `<tr><th scope="row"><a href="/tools/${t.slug}/">${e(t.name)}</a></th><td>${e(t.kind)}</td><td>${e(t.goodFor[0])}</td></tr>`)
    .join("");
  const body = `
<div class="wrap page-head">
  ${breadcrumbs(crumbs.slice(0, 1).concat([{ label: "Tools" }]))}
  <h1>AI and automation tools worth knowing</h1>
  <p class="lede">Short, plain profiles: what each tool is for, who it suits and who should skip it. Prices change often, so each profile points you to the official plan page.</p>
  ${state.hasAffiliates ? `<p class="fine">Some links below are affiliate links. <a href="/affiliate-disclosure/">How that works</a>.</p>` : ""}
</div>
<div class="wrap">
  <ul class="tool-rows">${state.tools.map(toolRow).join("")}</ul>
  <h2 class="table-h">At a glance</h2>
  <div class="table-wrap"><table class="glance"><thead><tr><th scope="col">Tool</th><th scope="col">Type</th><th scope="col">A good fit if you want to</th></tr></thead><tbody>${rows}</tbody></table></div>
</div>`;
  return page({
    title: "AI and automation tools worth knowing",
    description: "Plain-English profiles of AI assistants, code editors and automation platforms: who each one suits and who should skip it.",
    path: "/tools/",
    body,
    jsonLd: [breadcrumbLd(crumbs)],
  });
}

export function toolPage(tool) {
  const crumbs = [{ label: "Home", href: "/" }, { label: "Tools", href: "/tools/" }, { label: tool.name, href: `/tools/${tool.slug}/` }];
  const mentions = state.posts.filter(
    (p) => p.tags.some((t) => t.toLowerCase() === tool.name.toLowerCase()) || p.tags.some((t) => t.toLowerCase().replace(/\s+api$/, "") === tool.name.toLowerCase())
  );
  const related = (tool.related || []).map((s) => state.tools.find((t) => t.slug === s)).filter(Boolean);
  const li = (arr) => arr.map((x) => `<li>${e(x)}</li>`).join("");
  const body = `
<div class="wrap page-head">
  ${breadcrumbs(crumbs.map((c, i) => (i === crumbs.length - 1 ? { label: tool.name } : c)))}
  <h1>${e(tool.name)}</h1>
  <p class="tool-kind">${e(tool.kind)}</p>
  <p class="lede">${e(tool.tagline)}</p>
  <p>${visitLink(tool, "btn-primary")}</p>
  ${tool.affiliateUrl ? `<p class="fine">This page contains an affiliate link. <a href="/affiliate-disclosure/">Details</a>.</p>` : ""}
</div>
<div class="wrap narrow">
  <div class="prose">
    <p>${e(tool.summary)}</p>
    <div class="fit-grid">
      <div><h2>A good fit if</h2><ul>${li(tool.goodFor)}</ul></div>
      <div><h2>Skip it if</h2><ul>${li(tool.skipIf)}</ul></div>
    </div>
    <h2>Pricing</h2>
    <p>${e(tool.pricing)}</p>
    <p class="fine">This profile summarises what the tool is for. Plans, limits and features change often, so confirm the details on the official site before you decide.</p>
  </div>
  ${
    mentions.length
      ? `<h2 class="table-h">Articles that use ${e(tool.name)}</h2>${postList(mentions)}`
      : ""
  }
  ${
    related.length
      ? `<h2 class="table-h">Compare with</h2><ul class="tool-rows">${related.map(toolRow).join("")}</ul>`
      : ""
  }
</div>`;
  return page({
    title: `${tool.name}: who it's for and who should skip it`,
    description: `${tool.tagline} ${tool.goodFor[0]}.`,
    path: `/tools/${tool.slug}/`,
    body,
    jsonLd: [breadcrumbLd(crumbs)],
  });
}

export function goPage(tool) {
  const target = tool.affiliateUrl || tool.url;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Redirecting to ${e(tool.name)}</title>
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="origin">
<meta http-equiv="refresh" content="0;url=${e(target)}">
<link rel="canonical" href="${e(target)}">
<style>body{font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}</style>
</head><body><p>Taking you to <a href="${e(target)}" rel="sponsored nofollow">${e(tool.name)}</a>…</p>
<script>location.replace(${JSON.stringify(target)})</script></body></html>`;
}

// ---------------------------------------------------------------------------
// Static (markdown) pages, newsletter, thanks, 404
// ---------------------------------------------------------------------------
export function prosePage(pg) {
  // pg: {title, description, path, html, updated, toc, afterHtml}
  const crumbs = [{ label: "Home", href: "/" }, { label: pg.title, href: pg.path }];
  const body = `
<div class="wrap page-head">
  ${breadcrumbs([crumbs[0], { label: pg.title }])}
  <h1>${e(pg.title)}</h1>
  ${pg.lede ? `<p class="lede">${e(pg.lede)}</p>` : ""}
  ${pg.updated ? `<p class="fine">Last updated ${formatDate(pg.updated)}</p>` : ""}
</div>
<div class="wrap narrow">
  <div class="prose">${pg.html}</div>
  ${pg.cta ? `<section class="post-cta"><h2>Get the next workflow by email</h2><p>${e(site.newsletter.promise)}</p>${subscribeForm({ source: `page-${pg.slug}`, button: "Subscribe", note: "" })}</section>` : ""}
</div>`;
  return page({
    title: pg.title,
    description: pg.description,
    path: pg.path,
    body,
    noindex: Boolean(pg.noindex),
    jsonLd: [breadcrumbLd(crumbs)],
  });
}

export function newsletterPage() {
  const crumbs = [{ label: "Home", href: "/" }, { label: "Newsletter", href: "/newsletter/" }];
  const recent = state.posts.slice(0, 3);
  const body = `
<div class="wrap page-head">
  ${breadcrumbs([crumbs[0], { label: "Newsletter" }])}
  <h1>One tested workflow a week</h1>
  <p class="lede">Each issue covers a single automation: what it does, the code or setup, what it cost to run, and what broke. Short enough to read over coffee.</p>
  ${subscribeForm({ source: "newsletter-page", button: "Subscribe" })}
</div>
<div class="wrap narrow">
  <div class="prose">
    <h2>What you get</h2>
    <ul>
      <li>One workflow you can copy, with the code or the setup steps.</li>
      <li>Honest notes on cost, limits and failure modes.</li>
      <li>First access to new tool profiles and comparisons.</li>
    </ul>
    <p>You can leave at any time with one click. We never sell or share your address. Read the <a href="/privacy-policy/">privacy policy</a>.</p>
  </div>
  ${recent.length ? `<h2 class="table-h">Recent articles</h2>${postList(recent)}` : ""}
</div>`;
  return page({
    title: "Newsletter",
    description: "One tested AI automation workflow every week, with the code or setup. Free, and you can unsubscribe in one click.",
    path: "/newsletter/",
    body,
    jsonLd: [breadcrumbLd(crumbs)],
  });
}

export function thanksPage() {
  const body = `
<div class="wrap page-head">
  <h1>Thanks for subscribing</h1>
  <p class="lede">If we sent a confirmation email, click the link inside to finish. It can take a few minutes, and it sometimes lands in spam or promotions.</p>
  <p><a class="btn btn-primary" href="/blog/">Read the latest articles</a> <a class="btn btn-quiet" href="/resources/">Open the starter kit</a></p>
</div>`;
  return page({ title: "Thanks for subscribing", description: "Confirm your subscription.", path: "/thanks/", body, noindex: true });
}

export function confirmedPage() {
  const body = `
<div class="wrap page-head">
  <h1>You're subscribed</h1>
  <p class="lede">Your address is confirmed. The next weekly workflow will arrive in your inbox. While you wait, the starter kit has 25 workflows worth automating.</p>
  <p><a class="btn btn-primary" href="/resources/">Open the starter kit</a> <a class="btn btn-quiet" href="/blog/">Read the latest articles</a></p>
</div>`;
  return page({ title: "You're subscribed", description: "Your subscription is confirmed.", path: "/confirmed/", body, noindex: true });
}

export function notFoundPage() {
  const body = `
<div class="wrap page-head">
  <h1>That page isn't here</h1>
  <p class="lede">The link may be old or mistyped. Try the latest articles or search for what you need.</p>
  <p><a class="btn btn-primary" href="/blog/">Browse articles</a> <button class="btn btn-outline" type="button" data-search-open>Search</button></p>
</div>`;
  return page({ title: "Page not found", description: "Page not found.", path: "/404.html", body, noindex: true });
}
