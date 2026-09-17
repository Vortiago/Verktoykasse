#!/usr/bin/env node
// canonical source: vanilla-web/tools/check-css-tokens.mjs@c4bda18 sha256:7ca82f9960288483f47cd19ae65d85b4c6e6559f34e31553ea77ad78dd1f368d - vendored copy, do not edit here
// @ts-check
// check-css-tokens — enforces the closed token vocabulary: raw-color,
// inline-style, unscoped-css, viewport-media. The rules and their rationale are
// in reference/css.md; the decision is docs/adr/0007. check-css-vars guards the
// mirror direction, an undefined var(--x).
// Escape: /* gate-allow: <rule>[, rule] */ on the line, or in the first 10.
import { readFileSync } from "node:fs";
import { ROOT, SKIP, scanPaths, lineOf } from "./js-scan.mjs";

/** Trailing `(` required, so `color-mix(in oklch, …)` is a colour space, not a literal. */
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const HEX = /#[0-9a-f]{3,8}\b/gi;
/** Omits the system keywords and `transparent`/`currentColor`: no design decision, no drift. */
const NAMED = /\b(?:red|green|blue|yellow|orange|purple|pink|brown|gray|grey|black|white|cyan|magenta|lime|navy|teal|olive|maroon|silver|gold|violet|indigo|crimson|salmon|khaki|tomato|orchid|plum|beige|ivory|coral|azure|aqua|fuchsia)\b/gi;

/** Candidates per property family, filtered against what the tree defines, so
 * renaming a token changes the advice without touching this table.
 * @type {Array<[RegExp, string[]]>} */
const ADVICE = [
  [/^(background|background-color)$/, ["--bg", "--bg-elev", "--bg-elev-2"]],
  [/^(color|caret-color)$/, ["--text", "--text-dim", "--accent", "--ok", "--warn", "--bad", "--info"]],
  [/^(border|border-.*color|border-[a-z-]*|outline|outline-color)$/, ["--hairline", "--line", "--accent"]],
  [/^box-shadow$/, ["--shadow-1", "--shadow-2", "--shadow-3"]],
  [/^(fill|stroke)$/, ["--text", "--text-dim", "--accent"]],
  [/^(text-decoration-color|column-rule-color|accent-color)$/, ["--accent", "--text-dim"]],
];

/** Blanks comments, preserving offsets — line numbers and the comment-borne
 * escape test both read them. @param {string} text */
const stripCss = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

/** Walks rather than matches: a selector ends at `{` and a declaration at `;`
 * or `}`, the one distinction a single pattern over CSS cannot make.
 * @param {string} css comment-stripped source
 * @returns {Array<{prop: string, value: string, at: number}>} value-start offsets */
function declarations(css) {
  /** @type {Array<{prop: string, value: string, at: number}>} */ const out = [];
  let start = 0, depth = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c !== "{" && c !== "}" && c !== ";") continue;
    if (c === "{") { depth++; start = i + 1; continue; }
    if (depth > 0) {
      const chunk = css.slice(start, i);
      const colon = chunk.indexOf(":");
      if (colon !== -1) {
        const prop = chunk.slice(0, colon).trim();
        if (/^(--)?[a-z][a-z0-9-]*$/i.test(prop)) {   // else: a stray prelude fragment
          out.push({ prop, value: chunk.slice(colon + 1), at: start + colon + 1 });
        }
      }
    }
    if (c === "}") depth = Math.max(0, depth - 1);
    start = i + 1;
  }
  return out;
}

/** Quoted spans — a font family named "Ivory" is not a colour. @param {string} v */
function quoted(v) {
  /** @type {Array<[number, number]>} */ const spans = [];
  for (const m of v.matchAll(/"[^"]*"|'[^']*'/g)) spans.push([m.index, m.index + m[0].length]);
  return spans;
}

/** `color-mix(…)` spans. Inside one, `black`/`white` are how this stack DERIVES
 * a shade (reference/css.md) — deleting that exemption fails button.css. A hex
 * inside a mix is still a literal. @param {string} v */
function mixes(v) {
  /** @type {Array<[number, number]>} */ const spans = [];
  for (const m of v.matchAll(/color-mix\s*\(/gi)) {
    let depth = 0;
    for (let i = m.index + m[0].length - 1; i < v.length; i++) {
      if (v[i] === "(") depth++;
      else if (v[i] === ")" && --depth === 0) { spans.push([m.index, i + 1]); break; }
    }
  }
  return spans;
}

const files = scanPaths("**/*.css").filter((p) => !SKIP.test(p + "/"));
const html = scanPaths("**/*.html").filter((p) => !SKIP.test(p + "/"));

/** @type {Set<string>} every custom property defined in the tree */
const defined = new Set();
/** @type {Map<string, string>} colour literal (lowercased) → the token holding it */
const byValue = new Map();
/** @type {string[]} tokens whose value IS a colour, for advice that would
 * otherwise guess from the name and miss a token called `--rail` */
const colorTokens = [];
for (const rel of files) {
  const css = stripCss(readFileSync(new URL(rel, ROOT), "utf8"));
  for (const d of declarations(css)) {
    if (!d.prop.startsWith("--")) continue;
    defined.add(d.prop);
    const skip = quoted(d.value);
    let holdsColor = false;
    for (const re of [HEX, COLOR_FN, NAMED]) {
      for (const m of d.value.matchAll(re)) {
        if (skip.some(([a, b]) => m.index >= a && m.index < b)) continue;
        holdsColor = true;
        const lit = m[0].toLowerCase().replace(/\($/, "");
        if (re === HEX && !byValue.has(lit)) byValue.set(lit, d.prop);
      }
    }
    if (holdsColor && !colorTokens.includes(d.prop)) colorTokens.push(d.prop);
  }
}

/** @param {string} prop @param {string} literal */
function adviceFor(prop, literal) {
  const exact = byValue.get(literal.toLowerCase());
  if (exact) return `that value is already ${exact} — use var(${exact})`;
  const family = ADVICE.find(([re]) => re.test(prop))?.[1].filter((t) => defined.has(t)) ?? [];
  if (family.length) return `use one of ${family.join(", ")}`;
  // Naming the wrong token is worse than admitting the gap.
  return colorTokens.length
    ? `no token for ${prop} here; colours defined in this tree: ${colorTokens.slice(0, 8).join(", ")} — reuse one or define a new token at its definition site`
    : "define it as a custom property (tokens.css) and use var(--…) here";
}

/** @type {Array<{file: string, line: number, rule: string, msg: string}>} */
const findings = [];

/** Suppressions: file-wide from the first 10 lines, plus per-line.
 * @param {string} raw */
function allowances(raw) {
  /** @type {Set<string>} */ const file = new Set();
  /** @type {Map<number, Set<string>>} */ const perLine = new Map();
  raw.split("\n").forEach((ln, i) => {
    for (const m of ln.matchAll(/\/\*\s*gate-allow:\s*([\w-,\s]+?)\s*\*\//g)) {
      const rules = m[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (i < 10) for (const r of rules) file.add(r);
      const here = perLine.get(i + 1) ?? new Set();
      for (const r of rules) here.add(r);
      perLine.set(i + 1, here);
    }
  });
  return { file, perLine };
}

for (const rel of files) {
  const raw = readFileSync(new URL(rel, ROOT), "utf8");
  const css = stripCss(raw);
  const allow = allowances(raw);
  /** @param {number} line @param {string} rule @param {string} msg */
  const flag = (line, rule, msg) => {
    if (allow.file.has(rule) || allow.perLine.get(line)?.has(rule)) return;
    findings.push({ file: rel, line, rule, msg });
  };

  for (const d of declarations(css)) {
    if (d.prop.startsWith("--")) continue;   // the definition site: the one legal place
    const skip = quoted(d.value);
    const mix = mixes(d.value);
    for (const re of [HEX, COLOR_FN, NAMED]) {
      for (const m of d.value.matchAll(re)) {
        if (skip.some(([a, b]) => m.index >= a && m.index < b)) continue;
        if (re === NAMED && /^(?:black|white)$/i.test(m[0])
            && mix.some(([a, b]) => m.index >= a && m.index < b)) continue;
        const lit = m[0].replace(/\($/, "");
        flag(lineOf(css, d.at + m.index), "raw-color",
          `${d.prop}: ${lit} — raw colour outside a token definition; ${adviceFor(d.prop, lit)}`);
      }
    }
  }

  const isComponent = /(^|\/)components\//.test(rel);
  if ((isComponent || /(^|\/)views\//.test(rel)) && /\{/.test(css) && !/@scope\b/.test(css)) {
    flag(1, "unscoped-css",
      "component/view stylesheet with no @scope — wrap its rules in @scope (.<root-class>) so they cannot leak");
  }
  if (isComponent) {
    for (const m of css.matchAll(/@media[^{]*/g)) {
      if (!/\b(?:min-|max-)?(?:width|height|aspect-ratio)\b/.test(m[0])) continue;   // a feature query is fine
      flag(lineOf(css, m.index), "viewport-media",
        "dimension @media in a component — size off @container (the component's own width), not the viewport");
    }
  }
}

for (const rel of html) {
  const raw = readFileSync(new URL(rel, ROOT), "utf8");
  const text = raw.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
  const allow = allowances(raw);
  for (const m of text.matchAll(/\sstyle\s*=\s*["']/g)) {
    const line = lineOf(text, m.index);
    if (allow.file.has("inline-style") || allow.perLine.get(line)?.has("inline-style")) continue;
    findings.push({ file: rel, line, rule: "inline-style",
      msg: 'style="…" in a template — put the rule in the component .css, and pass anything dynamic as a custom property' });
  }
}

if (findings.length) {
  console.error(`✖ ${findings.length} CSS token violation${findings.length === 1 ? "" : "s"} (rules: reference/css.md):`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.rule}  ${f.msg}`);
  process.exit(1);
}
console.log(`✓ check-css-tokens: ${files.length} stylesheets + ${html.length} templates clean against ${defined.size} defined custom properties (raw-color, inline-style, unscoped-css, viewport-media)`);
