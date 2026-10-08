# Loopwise

A fast, content-first site about AI automation, built to earn from **ads, affiliate links, a newsletter, reader support and sponsorships**.

- **Name:** Loopwise (the "loop" is the idea: build a workflow once, let it run). The logo, the home-page loop and the four content categories all come from it.
- **Stack:** a small static-site generator in plain Node (no framework), self-hosted fonts, one CSS file, one small JS file. It scores well on Core Web Vitals by default and costs nothing to host.
- **Why not Next.js?** The original brainstorm specified Next.js + Supabase + Algolia. For a content site those add cost and moving parts without adding revenue. This build keeps every feature in the spec that makes money or ranks (see the table below) and drops the database. Everything is plain Markdown in git.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000, rebuilds on every save (includes drafts and future-dated posts)
npm run build      # outputs the site to dist/
npm run check      # finds broken links, missing anchors and basic SEO problems in dist/
```

Requires Node 20 or newer.

## What you got

| Spec item | Where it is |
| --- | --- |
| Homepage, blog listing, post pages | `/`, `/blog/`, `/blog/<slug>/` |
| Syntax-highlighted code (with copy button) | Built at build time, no client library |
| Table of contents, reading time, related posts, share buttons, author box | Automatic on every post |
| Search | Header search (press `/`), plus keyword filter on `/blog/` |
| Newsletter | Forms everywhere, endpoint in `api/subscribe.js` (Brevo) |
| AdSense | 3 slots per article (top, middle, end), loaded only after consent |
| Analytics | GA4, loaded only after consent, with affiliate-click events |
| Affiliate links | Tool profiles in `data/tools.json`, tracked redirects at `/go/<tool>/` |
| Patreon / Ko-fi | Set `KOFI_URL` or `PATREON_URL` |
| Sitemap, robots.txt, RSS, JSON-LD, Open Graph images | Generated on every build |
| Privacy policy, About, Contact, Terms, Affiliate disclosure, Advertise | `content/pages/*.md` |
| Beyond the spec | Tool profiles, "Starter kit" lead-magnet page, dark mode, consent banner, link checker, scheduled posts |

## Make it yours (do this first)

1. **Domain.** Buy one (check `loopwise.com`, `.dev`, `.io`; if all are taken, pick a close variant) and set `SITE_URL`.
2. **Your name.** Set `AUTHOR_NAME`, `AUTHOR_ROLE`, `AUTHOR_BIO` (and optionally `AUTHOR_GITHUB`, `AUTHOR_TWITTER`, `AUTHOR_LINKEDIN`). Edit `content/pages/about.md` to add your real background. Readers and AdSense reviewers both look for a real, credible author.
3. **Contact email.** Set `CONTACT_EMAIL` and make sure that mailbox exists (your domain registrar or Cloudflare can forward it to Gmail for free).
4. Run `npm run og` after changing the name, tagline or adding posts (it regenerates the social-share images and icons; needs `npm install` first).

### Environment variables

Set these in your host's dashboard (Vercel: Project, Settings, Environment Variables). Everything is optional and every feature stays off until its variable is set.

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Your final URL, e.g. `https://loopwise.dev` (canonicals, sitemap, feeds) |
| `AUTHOR_NAME`, `AUTHOR_ROLE`, `AUTHOR_BIO`, `AUTHOR_GITHUB`, `AUTHOR_TWITTER`, `AUTHOR_LINKEDIN` | Byline and author box |
| `CONTACT_EMAIL` | Shown on Contact, About, policies |
| `GA_MEASUREMENT_ID` | GA4 (`G-XXXXXXXXXX`) |
| `GSC_VERIFICATION` | Content of the Search Console `google-site-verification` meta tag |
| `ADSENSE_CLIENT` | `ca-pub-...`, also writes `ads.txt` |
| `ADSENSE_SLOT_TOP`, `ADSENSE_SLOT_MIDDLE`, `ADSENSE_SLOT_END` | Ad unit IDs |
| `KOFI_URL`, `PATREON_URL` | Support links in footer and sidebar |
| `BREVO_API_KEY`, `BREVO_LIST_ID` | Newsletter signups (required for the form to work) |
| `BREVO_DOI_TEMPLATE_ID` | Optional: double opt-in (recommended for EU readers) |

## Deploy (free)

**Vercel:** push this folder to GitHub, import it at vercel.com/new. It detects `vercel.json`; the build command is `npm run build`, output `dist`. Add the environment variables, deploy, then add your domain.

**Netlify:** same idea; `netlify.toml` is included and `netlify/functions/subscribe.mjs` serves `/api/subscribe`.

Other static hosts (Cloudflare Pages, GitHub Pages) work for everything except the newsletter endpoint. Use a Brevo-hosted signup form there instead.

## Set up the newsletter (Brevo)

1. Create a Brevo account, make a contact list, note its numeric ID (`BREVO_LIST_ID`).
2. Create an API key (`BREVO_API_KEY`). Never commit it.
3. Optional but recommended: create a double opt-in email template and set `BREVO_DOI_TEMPLATE_ID`. Subscribers are then redirected to `/confirmed/` after clicking the link.
4. Add a welcome automation in Brevo that links to `/resources/` (the starter kit) as the thank-you gift.
5. Check Brevo's current free-plan sending limit before you plan volume. The original brainstorm said 300 emails per month; Brevo has historically advertised a per-day limit, so verify on their pricing page.

## Publishing posts

Create `content/posts/your-slug.md`:

```md
---
title: "Under 62 characters if possible"
description: "70-160 characters. This is your Google snippet."
date: "2026-10-12"
updated: "2026-11-01"        # optional
category: build              # build | compare | automate | ship
tags: ["Claude API", "Python"]
draft: false                 # true hides it
---

Intro paragraph. Use ## and ### headings; they become the table of contents.
```

- Code fences take a title: ` ```python title="app.py" `. Callouts: `> [!TIP]`, `> [!NOTE]`, `> [!WARNING]`, `> [!IMPORTANT]`.
- **Affiliate links:** write `[Cursor](/go/cursor/)` and the post automatically shows a disclosure.
- **Scheduling:** a post with a future date stays hidden until the next build on or after that date. `.github/workflows/daily-rebuild.yml` triggers a daily rebuild if you save a deploy-hook URL as the `DEPLOY_HOOK_URL` GitHub secret.
- The build warns about thin posts (<800 words), long titles and bad description lengths. `docs/content-plan.md` has 30 post ideas mapped to keywords.

## Earning money: what to do and when

1. **Weeks 1-4: publish and get indexed.** Deploy, verify the site in Google Search Console, submit `/sitemap.xml`, and publish consistently. Share each post where developers actually read (relevant subreddits, Hacker News when it is genuinely useful, X, LinkedIn).
2. **Affiliate links first, ads second.** Apply to each tool's affiliate or partner programme (search "<tool> affiliate program"), then paste the tracking URL into `affiliateUrl` in `data/tools.json`. For a small developer audience, affiliate and sponsorship income per visitor is usually much higher than AdSense.
3. **Apply to AdSense** once you have roughly 15-20 substantial original posts and the About, Contact, Privacy and Terms pages (all included). Set `ADSENSE_CLIENT`, create three ad units and set the slot variables.
4. **Newsletter.** The list is the asset you own. Send a short weekly issue; sponsorships of 1 slot per issue become possible once you have a few thousand engaged subscribers.
5. **Reader support.** Add your Ko-fi or Patreon URL once there is something readers value.

### Corrections to the original brainstorm

A few statements in the spec doc are not accurate. I built the site to the accurate version:

- AdSense has no published minimum page-view count (the "25,000 page views" figure isn't an official requirement) and no longer caps ads at three per page. Approval depends on original, useful content, a clear site structure and policy compliance, and age requirements vary by country, so check Google's current eligibility page. I kept three slots per article for readability.
- The 6-month **$500-2,000/month** target is optimistic for a new site. Search traffic usually takes several months to build. Treat those numbers as a stretch goal, not a forecast. How fast you grow depends mostly on how many genuinely useful posts you publish and whether they match what people search for.
- Tailwind, Supabase and Algolia were dropped, not forgotten: they add cost and complexity but no revenue at this stage.

## Things to check before you go live

- The code samples were written against the official SDK documentation, but they have **not been run against the live APIs** from the build environment (no keys, no registry access). Run each one once and fix anything that has drifted before publishing. Model IDs change, so confirm them on the vendors' model pages.
- The legal pages are sensible templates, not legal advice. Have them reviewed for your country, especially if you will have EU/UK readers.
- The built-in cookie banner keeps analytics and ads off until a visitor accepts, which is the safe default. For EU/UK/Swiss traffic, Google requires AdSense publishers to use a Google-certified consent platform; the free one is Funding Choices (in the AdSense dashboard under Privacy & messaging). Set that up when AdSense approves you.
- Tool profiles in `data/tools.json` describe what each product is for. Prices and limits change often, so each profile points readers to the official pricing page. Re-read them every few months.

## Project layout

```
build.mjs            site generator
site.config.mjs      name, nav, categories, env-driven settings
content/posts/       articles (Markdown)
content/pages/       About, Contact, policies, starter kit
data/tools.json      tool profiles + affiliate URLs
lib/                 templates, Markdown, syntax highlighter
static/              CSS, JS, fonts, icons, share images (copied to dist/)
api/                 newsletter endpoint (Vercel); netlify/functions/ for Netlify
scripts/             dev server, link checker, font + image generators
docs/content-plan.md 30 post ideas with target keywords
```
