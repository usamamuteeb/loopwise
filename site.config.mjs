// Everything you are likely to change lives here or in environment variables.
// Set env vars in Vercel / Netlify / Cloudflare (Project Settings -> Environment Variables).

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Load a local .env file (KEY=value per line) so you don't have to set variables in the terminal.
// Real environment variables (e.g. on Vercel) always win over the file.
const envFile = join(dirname(fileURLToPath(import.meta.url)), ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const value = m[2].replace(/^(["'])(.*)\1$/, "$2");
    if (value !== "" && process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

const env = process.env;

const url = (env.SITE_URL || "https://loopwise.dev").replace(/\/+$/, "");
const host = new URL(url).hostname;

export default {
  name: "Loopwise",
  tagline: "Build the loop once. Let it run.",
  description:
    "Tested AI automation workflows, tool profiles and Python tutorials for people who would rather build a system than repeat a task.",
  url,
  language: "en",
  locale: "en_US",

  // Author shown on posts, in JSON-LD and on the About page. Replace with your real name and bio:
  // AdSense and readers both trust a real, named author.
  author: {
    name: env.AUTHOR_NAME || "Loopwise Editorial",
    role: env.AUTHOR_ROLE || "Developer and automation writer",
    bio:
      env.AUTHOR_BIO ||
      "Articles cover AI APIs, automation and developer tools, with the code published alongside every tutorial.",
    twitter: env.AUTHOR_TWITTER || "", // handle without @
    github: env.AUTHOR_GITHUB || "",
    linkedin: env.AUTHOR_LINKEDIN || "", // full URL
  },

  contactEmail: env.CONTACT_EMAIL || `hello@${host}`,

  // ---- Monetisation switches (everything is off until you set the value) ----
  adsense: {
    client: env.ADSENSE_CLIENT || "", // e.g. ca-pub-1234567890123456
    publisherId: env.ADSENSE_CLIENT ? env.ADSENSE_CLIENT.replace("ca-", "") : "", // for ads.txt
    slots: {
      top: env.ADSENSE_SLOT_TOP || "", // below post intro
      middle: env.ADSENSE_SLOT_MIDDLE || "", // inside article, after the 2nd section
      end: env.ADSENSE_SLOT_END || "", // after the article
    },
  },
  analytics: {
    ga4: env.GA_MEASUREMENT_ID || "", // e.g. G-XXXXXXXXXX
    searchConsoleVerification: env.GSC_VERIFICATION || "", // content of the google-site-verification meta tag
    bingVerification: env.BING_VERIFICATION || "",
  },
  support: {
    kofi: env.KOFI_URL || "", // https://ko-fi.com/yourname
    patreon: env.PATREON_URL || "",
  },
  newsletter: {
    // The form posts to /api/subscribe (see api/subscribe.js, needs BREVO_API_KEY + BREVO_LIST_ID on the host).
    endpoint: "/api/subscribe",
    promise: "One tested workflow every week. No filler, unsubscribe in one click.",
  },

  // Home page loop = site navigation. Each station is a content category.
  categories: [
    {
      slug: "build",
      name: "Build",
      blurb: "API tutorials and working code for Claude and other models.",
    },
    {
      slug: "compare",
      name: "Compare",
      blurb: "Side-by-side tests so you can pick a tool without a trial-and-error month.",
    },
    {
      slug: "automate",
      name: "Automate",
      blurb: "Python and no-code workflows that run without you.",
    },
    {
      slug: "ship",
      name: "Ship",
      blurb: "Case studies: real problems, the setup, and what it cost.",
    },
  ],

  nav: [
    { href: "/blog/", label: "Articles" },
    { href: "/tools/", label: "Tools" },
    { href: "/resources/", label: "Starter kit" },
    { href: "/about/", label: "About" },
  ],

  postsPerFeed: 20,
  wordsPerMinute: 220,
};
