import { Marked } from "marked";
import { highlight, normalizeLang } from "./highlight.mjs";
import { escapeHtml, slugify, stripTags, countWords } from "./util.mjs";

const LANG_LABELS = {
  python: "Python", javascript: "JavaScript", bash: "Terminal", json: "JSON", yaml: "YAML",
  css: "CSS", html: "HTML", diff: "Diff", sql: "SQL",
};

const CALLOUTS = {
  NOTE: "Note",
  TIP: "Tip",
  WARNING: "Warning",
  IMPORTANT: "Important",
};

/**
 * Render markdown to HTML with: heading ids + TOC, build-time syntax highlighting,
 * GitHub-style callouts (> [!TIP]), safe external links and sponsored-link rel attributes.
 */
export function renderMarkdown(source, { siteHost = "", affiliates = new Set() } = {}) {
  const toc = [];
  const used = new Map();
  const uniqueId = (text) => {
    const base = slugify(text) || "section";
    const n = used.get(base) || 0;
    used.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };

  const md = new Marked({ gfm: true, breaks: false });
  md.use({
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        if (depth < 2 || depth > 3) return `<h${depth}>${inner}</h${depth}>\n`;
        const text = stripTags(inner);
        const id = uniqueId(text);
        toc.push({ depth, id, text });
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${inner}</h${depth}>\n`;
      },

      code({ text, lang }) {
        const info = (lang || "").trim();
        const titleMatch = info.match(/title="([^"]+)"/);
        const language = normalizeLang(info.split(/\s+/)[0] || "");
        const label = titleMatch ? titleMatch[1] : LANG_LABELS[language] || (language ? language : "Code");
        const body = highlight(text.replace(/\n$/, ""), language);
        return (
          `<figure class="code" data-lang="${escapeHtml(language || "text")}">` +
          `<figcaption><span>${escapeHtml(label)}</span><button type="button" class="copy" data-copy>Copy</button></figcaption>` +
          `<pre tabindex="0"><code>${body}</code></pre></figure>\n`
        );
      },

      link({ href, title, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const t = title ? ` title="${escapeHtml(title)}"` : "";
        const h = escapeHtml(href);
        if (href.startsWith("/go/")) {
          const slug = href.split("/")[2];
          // Real affiliate tool: tracked, marked sponsored. Otherwise link to our own profile page (no outbound redirect, no disclosure needed).
          return affiliates.has(slug)
            ? `<a href="${h}"${t} rel="sponsored nofollow noopener">${inner}</a>`
            : `<a href="/tools/${escapeHtml(slug)}/"${t}>${inner}</a>`;
        }
        const external = /^https?:\/\//i.test(href) && !(siteHost && new URL(href).hostname.endsWith(siteHost));
        return external
          ? `<a href="${h}"${t} target="_blank" rel="noopener noreferrer">${inner}</a>`
          : `<a href="${h}"${t}>${inner}</a>`;
      },

      blockquote({ tokens }) {
        const body = this.parser.parse(tokens);
        const m = body.match(/^<p>\[!(NOTE|TIP|WARNING|IMPORTANT)\]\s*(?:<br\s*\/?>)?\s*/);
        if (!m) return `<blockquote>${body}</blockquote>\n`;
        const kind = m[1];
        const rest = `<p>${body.slice(m[0].length)}`;
        return `<aside class="callout callout-${kind.toLowerCase()}"><p class="callout-title">${CALLOUTS[kind]}</p>${rest}</aside>\n`;
      },

      image({ href, title, text }) {
        const t = title ? ` title="${escapeHtml(title)}"` : "";
        return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${t} loading="lazy" decoding="async">`;
      },
    },
  });

  let html = md.parse(source);
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
  return { html, toc, words: countWords(html), text: stripTags(html) };
}
