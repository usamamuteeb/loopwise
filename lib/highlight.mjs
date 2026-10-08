// Small build-time syntax highlighter. No client JS, no dependencies.
// Each language is an ordered list of [className, regex]. The first rule that matches at a position wins.

import { escapeHtml } from "./util.mjs";

const kw = (words) => new RegExp(`\\b(?:${words.join("|")})\\b`);

const PY_KEYWORDS = [
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else",
  "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not",
  "or", "pass", "raise", "return", "try", "while", "with", "yield", "match", "case",
];
const PY_BUILTINS = ["None", "True", "False", "self", "cls", "print", "len", "range", "dict", "list", "set", "str", "int", "float", "bool", "open", "isinstance", "enumerate", "zip", "sum", "min", "max", "sorted", "super"];

const JS_KEYWORDS = [
  "async", "await", "break", "case", "catch", "class", "const", "continue", "default", "delete", "do",
  "else", "export", "extends", "finally", "for", "from", "function", "if", "import", "in", "instanceof",
  "let", "new", "of", "return", "static", "switch", "throw", "try", "typeof", "var", "while", "yield",
  "interface", "type", "enum", "implements", "readonly", "as",
];
const JS_BUILTINS = ["null", "undefined", "true", "false", "this", "console", "process", "window", "document", "JSON", "Promise", "Math", "Object", "Array"];

const LANGS = {
  python: [
    ["c", /#.*/],
    ["s", /[rRbBfFuU]{0,2}(?:"""[\s\S]*?"""|'''[\s\S]*?''')/],
    ["s", /[rRbBfFuU]{0,2}"(?:\\.|[^"\\\n])*"/],
    ["s", /[rRbBfFuU]{0,2}'(?:\\.|[^'\\\n])*'/],
    ["d", /@[A-Za-z_][\w.]*/],
    ["k", kw(PY_KEYWORDS)],
    ["b", kw(PY_BUILTINS)],
    ["n", /\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b/],
    ["f", /\b[A-Za-z_]\w*(?=\()/],
  ],
  javascript: [
    ["c", /\/\/.*|\/\*[\s\S]*?\*\//],
    ["s", /`(?:\\.|[^`\\])*`/],
    ["s", /"(?:\\.|[^"\\\n])*"/],
    ["s", /'(?:\\.|[^'\\\n])*'/],
    ["k", kw(JS_KEYWORDS)],
    ["b", kw(JS_BUILTINS)],
    ["n", /\b\d[\d_]*(?:\.\d+)?\b/],
    ["f", /\b[A-Za-z_$][\w$]*(?=\()/],
  ],
  bash: [
    ["c", /(?:^|(?<=\s))#.*/],
    ["s", /"(?:\\.|[^"\\])*"/],
    ["s", /'[^']*'/],
    ["b", /\$\{?[A-Za-z_][\w]*\}?/],
    ["k", kw(["if", "then", "else", "fi", "for", "do", "done", "while", "case", "esac", "export", "source", "function", "in"])],
    ["d", /(?<=\s)--?[A-Za-z][\w-]*/],
    ["n", /\b\d+\b/],
  ],
  json: [
    ["p", /"(?:\\.|[^"\\\n])*"(?=\s*:)/],
    ["s", /"(?:\\.|[^"\\\n])*"/],
    ["b", /\b(?:true|false|null)\b/],
    ["n", /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/],
  ],
  yaml: [
    ["c", /#.*/],
    ["p", /^[ \t-]*[A-Za-z_][\w.-]*(?=:)/m],
    ["s", /"(?:\\.|[^"\\\n])*"/],
    ["s", /'[^'\n]*'/],
    ["b", /\b(?:true|false|null|yes|no)\b/],
    ["n", /\b\d+(?:\.\d+)?\b/],
  ],
  css: [
    ["c", /\/\*[\s\S]*?\*\//],
    ["s", /"[^"\n]*"|'[^'\n]*'/],
    ["k", /@[\w-]+/],
    ["p", /[a-z-]+(?=\s*:)/],
    ["n", /#[0-9a-fA-F]{3,8}\b|-?\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms)?\b/],
  ],
  html: [
    ["c", /<!--[\s\S]*?-->/],
    ["k", /<\/?[A-Za-z][\w-]*/],
    ["p", /\b[A-Za-z-]+(?==)/],
    ["s", /"[^"]*"|'[^']*'/],
  ],
  diff: [
    ["add", /^\+.*$/m],
    ["del", /^-.*$/m],
    ["c", /^@@.*$/m],
  ],
  sql: [
    ["c", /--.*|\/\*[\s\S]*?\*\//],
    ["s", /'(?:''|[^'])*'/],
    ["k", /\b(?:select|from|where|insert|into|values|update|set|delete|create|table|index|primary|key|references|default|not|null|unique|order|by|group|limit|join|left|right|inner|on|and|or|as|desc|asc)\b/i],
    ["n", /\b\d+\b/],
  ],
};

const ALIASES = {
  py: "python", python3: "python",
  js: "javascript", jsx: "javascript", ts: "javascript", tsx: "javascript", typescript: "javascript", mjs: "javascript", node: "javascript",
  sh: "bash", shell: "bash", zsh: "bash", console: "bash", terminal: "bash",
  yml: "yaml", jsonc: "json", htm: "html", xml: "html", patch: "diff",
};

export function normalizeLang(lang = "") {
  const l = lang.toLowerCase();
  return ALIASES[l] || l;
}

export function highlight(code, lang) {
  const rules = LANGS[normalizeLang(lang)];
  if (!rules) return escapeHtml(code);

  // Build one sticky-ish scanner: find the earliest match among rules at each step.
  const compiled = rules.map(([cls, re]) => ({ cls, re: new RegExp(re.source, re.flags.replace(/[gy]/g, "") + "g") }));
  let out = "";
  let pos = 0;
  while (pos < code.length) {
    let best = null;
    for (const rule of compiled) {
      rule.re.lastIndex = pos;
      const m = rule.re.exec(code);
      if (m && m[0].length > 0 && (!best || m.index < best.index)) best = { index: m.index, text: m[0], cls: rule.cls };
      if (best && best.index === pos) break; // rule order breaks ties at the same position
    }
    if (!best) {
      out += escapeHtml(code.slice(pos));
      break;
    }
    if (best.index > pos) out += escapeHtml(code.slice(pos, best.index));
    out += `<span class="t-${best.cls}">${escapeHtml(best.text)}</span>`;
    pos = best.index + best.text.length;
  }
  return out;
}
