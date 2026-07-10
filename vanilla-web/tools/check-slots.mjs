#!/usr/bin/env node
// @ts-check
// check-slots — static gate for the .html ↔ .js template seam, the one boundary
// `tsc` cannot see. Template ids and data-slot names are stringly-typed:
// a typo'd tpl("tpl-buttn") throws only at runtime, and a typo'd slot key
// silently renders nothing (slot() is querySelectorAll-based). This walks
// **/*.html for <template id="tpl-…"> ids + data-slot names, and **/*.js for
// the string literals in tpl("…"), pick(el, "…"), slot(frag, {…}) keys, and
// [data-slot="…"] selectors (regex-grade — the conventions keep these calls
// syntactically uniform).
//
//   error    tpl() id with no <template id> in any .html
//   error    pick()/slot()/selector name with no data-slot marker anywhere
//   warning  template or data-slot never referenced from JS (dead markup —
//            non-fatal: tests may reach slots via querySelector/getByTestId)
//
// Scope is the whole app namespace, not per-template: a pick() takes a runtime
// fragment, so the checker can't know which template it targets — pooling all
// ids/names still catches the typo class, which is the point. JS-created
// markers (dataset.slot = "x", setAttribute("data-slot", …)) count as defined.
// node_modules/ and testing/ (deliberately-weird fixtures) are skipped.
// Zero-dep; same shape + exit contract as check-css-vars. Exit 1 on any error.
import { globSync, readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url); // tools/ sits in the app/skill root
const SKIP = /(^|\/)(node_modules|testing)\//;
const html = globSync("**/*.html", { cwd: ROOT }).filter((p) => !SKIP.test(p + "/"));
const js = globSync("**/*.js", { cwd: ROOT }).filter((p) => !SKIP.test(p + "/"));

/** 1-based line of an index into text. @param {string} text @param {number} idx */
const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;

/** Blank out comments (// and /* *​/ in JS, <!-- --> in HTML) preserving offsets,
 * so doc-comment examples like tpl("tpl-run-row") don't count as references.
 * Quote-aware for JS: comment markers inside strings/templates are kept.
 * @param {string} text @param {boolean} isHtml */
function stripComments(text, isHtml) {
  if (isHtml) return text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  let out = "";
  /** @type {string[]} */ const ctx = []; // open string contexts: " ' ` ${
  for (let i = 0; i < text.length; i++) {
    const c = text[i], top = ctx[ctx.length - 1];
    if (top === '"' || top === "'") {
      out += c;
      if (c === "\\") { out += text[++i] ?? ""; }
      else if (c === top || c === "\n") ctx.pop();
    } else if (top === "`") {
      out += c;
      if (c === "\\") { out += text[++i] ?? ""; }
      else if (c === "`") ctx.pop();
      else if (c === "$" && text[i + 1] === "{") { out += text[++i]; ctx.push("${"); }
    } else { // code (top-level or inside ${…})
      if (c === "}" && top === "${") { ctx.pop(); out += c; }
      else if (c === '"' || c === "'" || c === "`") { ctx.push(c); out += c; }
      else if (c === "/" && text[i + 1] === "/") { while (i < text.length && text[i] !== "\n") { out += " "; i++; } out += text[i] ?? ""; }
      else if (c === "/" && text[i + 1] === "*") {
        const end = text.indexOf("*/", i + 2);
        const stop = end === -1 ? text.length : end + 2;
        out += text.slice(i, stop).replace(/[^\n]/g, " ");
        i = stop - 1;
      } else out += c;
    }
  }
  return out;
}

/** Balanced argument span of a call: text from after `(` at openIdx to its
 * matching `)`, skipping strings/templates. Null when unterminated.
 * @param {string} text @param {number} openIdx */
function argSpan(text, openIdx) {
  let depth = 0;
  /** @type {string[]} */ const ctx = [];
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i], top = ctx[ctx.length - 1];
    if (top === '"' || top === "'") {
      if (c === "\\") i++;
      else if (c === top || c === "\n") ctx.pop();
    } else if (top === "`") {
      if (c === "\\") i++;
      else if (c === "`") ctx.pop();
      else if (c === "$" && text[i + 1] === "{") { ctx.push("${"); i++; }
    } else {
      if (c === '"' || c === "'" || c === "`") ctx.push(c);
      else if (c === "(" || c === "{" || c === "[") depth++;
      else if (c === ")" || c === "}" || c === "]") { depth--; if (depth === 0) return text.slice(openIdx + 1, i); }
      if (top === "${" && c === "}" && depth >= 0) ctx.pop();
    }
  }
  return null;
}

/** Top-level (depth-0) split of an argument list on commas. @param {string} args */
function splitTop(args) {
  /** @type {string[]} */ const parts = [];
  let depth = 0, start = 0;
  /** @type {string[]} */ const ctx = [];
  for (let i = 0; i < args.length; i++) {
    const c = args[i], top = ctx[ctx.length - 1];
    if (top === '"' || top === "'" || top === "`") {
      if (c === "\\") i++;
      else if (c === top) ctx.pop();
    } else if (c === '"' || c === "'" || c === "`") ctx.push(c);
    else if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) { parts.push(args.slice(start, i)); start = i + 1; }
  }
  parts.push(args.slice(start));
  return parts;
}

// ── Collect definitions from .html ──────────────────────────────────────────
/** @type {Map<string, {file: string, line: number}>} */ const templates = new Map();
/** @type {Map<string, {file: string, line: number}>} */ const slotDefs = new Map();

for (const rel of html) {
  const text = stripComments(readFileSync(new URL(rel, ROOT), "utf8"), true);
  for (const m of text.matchAll(/<template\b[^>]*\bid=["'](tpl-[\w-]+)["']/g)) {
    if (!templates.has(m[1])) templates.set(m[1], { file: rel, line: lineOf(text, m.index) });
  }
  for (const m of text.matchAll(/\bdata-slot=["']([\w-]+)["']/g)) {
    if (!slotDefs.has(m[1])) slotDefs.set(m[1], { file: rel, line: lineOf(text, m.index) });
  }
}

// ── Collect references from .js ──────────────────────────────────────────────
/** @type {Array<{id: string, file: string, line: number}>} */ const tplRefs = [];
/** @type {Array<{name: string, file: string, line: number}>} */ const nameRefs = [];

for (const rel of js) {
  const text = stripComments(readFileSync(new URL(rel, ROOT), "utf8"), false);
  for (const m of text.matchAll(/\btpl\(\s*["'`]([\w-]+)["'`]/g)) {
    tplRefs.push({ id: m[1], file: rel, line: lineOf(text, m.index) });
  }
  // pick(el, "name") — balanced scan of the args, name = a plain-literal 2nd arg.
  for (const m of text.matchAll(/\bpick\s*\(/g)) {
    const args = argSpan(text, m.index + m[0].length - 1);
    if (args == null) continue;
    const second = splitTop(args)[1]?.trim() ?? "";
    const lit = second.match(/^["'`]([\w-]+)["'`]$/);
    if (lit) nameRefs.push({ name: lit[1], file: rel, line: lineOf(text, m.index) });
  }
  // slot(frag, { key: v, shorthand, "quoted": v }) — top-level keys of the 2nd arg.
  for (const m of text.matchAll(/\bslot\s*\(/g)) {
    const args = argSpan(text, m.index + m[0].length - 1);
    if (args == null) continue;
    const second = splitTop(args)[1]?.trim() ?? "";
    if (!second.startsWith("{")) continue;
    for (const entry of splitTop(second.slice(1, second.lastIndexOf("}")))) {
      const key = entry.trim().match(/^(?:["']([\w-]+)["']|([A-Za-z_$][\w$]*))\s*(?::|$)/);
      const name = key?.[1] ?? key?.[2];
      if (name && !entry.trim().startsWith("...")) nameRefs.push({ name, file: rel, line: lineOf(text, m.index) });
    }
  }
  // Selector references — querySelector('[data-slot="x"]') and friends.
  for (const m of text.matchAll(/\[data-slot=\\?["']?([\w-]+)/g)) {
    nameRefs.push({ name: m[1], file: rel, line: lineOf(text, m.index) });
  }
  // JS-created markers define, not reference: el.dataset.slot = "x" / setAttribute.
  for (const m of text.matchAll(/\.dataset\.slot\s*=\s*["'`]([\w-]+)["'`]/g)) {
    if (!slotDefs.has(m[1])) slotDefs.set(m[1], { file: rel, line: lineOf(text, m.index) });
  }
  for (const m of text.matchAll(/setAttribute\(\s*["'`]data-slot["'`]\s*,\s*["'`]([\w-]+)["'`]/g)) {
    if (!slotDefs.has(m[1])) slotDefs.set(m[1], { file: rel, line: lineOf(text, m.index) });
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const errors = [
  ...tplRefs.filter((r) => !templates.has(r.id))
    .map((r) => `${r.file}:${r.line}  tpl("${r.id}") — no <template id="${r.id}"> in any .html`),
  ...nameRefs.filter((r) => !slotDefs.has(r.name))
    .map((r) => `${r.file}:${r.line}  slot "${r.name}" — no data-slot="${r.name}" marker in any template`),
];
const usedTpl = new Set(tplRefs.map((r) => r.id));
const usedName = new Set(nameRefs.map((r) => r.name));
const warnings = [
  ...[...templates].filter(([id]) => !usedTpl.has(id))
    .map(([id, d]) => `${d.file}:${d.line}  <template id="${id}"> never referenced from JS`),
  ...[...slotDefs].filter(([name]) => !usedName.has(name))
    .map(([name, d]) => `${d.file}:${d.line}  data-slot="${name}" never referenced from JS`),
];

for (const w of warnings) console.warn(`  warning: ${w}`);
if (errors.length) {
  console.error(`✖ ${errors.length} template-seam error${errors.length === 1 ? "" : "s"} (typo, or .html and .js out of sync):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`✓ check-slots: ${tplRefs.length + nameRefs.length} template/slot references resolve (${templates.size} templates, ${slotDefs.size} slot names across ${html.length} .html + ${js.length} .js files${warnings.length ? `; ${warnings.length} warning(s)` : ""})`);
