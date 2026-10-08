// Tiny front-matter parser. Supports the YAML subset used by Loopwise posts:
//   key: value | key: "quoted" | key: [a, b, "c d"] | key: true | key: 12
// Anything fancier should not live in front matter.

function parseScalar(raw) {
  const v = raw.trim();
  if (v === "") return "";
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  return v;
}

function splitList(inner) {
  const items = [];
  let cur = "";
  let quote = null;
  for (const ch of inner) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === ",") {
      items.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim() !== "") items.push(cur);
  return items.map(parseScalar);
}

export function parseFrontmatter(source, file = "") {
  const text = source.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const [i, line] of m[1].split("\n").entries()) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) throw new Error(`${file}: bad front matter on line ${i + 1}: "${line}"`);
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    data[key] = val.startsWith("[") && val.endsWith("]") ? splitList(val.slice(1, -1)) : parseScalar(val);
  }
  return { data, body: text.slice(m[0].length) };
}
