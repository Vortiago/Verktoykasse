#!/usr/bin/env node
// @ts-check
// check-css-tokens — enforces the closed token vocabulary: raw-color,
// inline-style, unscoped-css, viewport-media. The rules and their rationale are
// in reference/css.md; the decision is docs/adr/0007. check-css-vars guards the
// mirror direction, an undefined var(--x).
// Escape: /* gate-allow: <rule>[, rule] */ (<!-- … --> in .html) on the line,
// or anywhere in the first 10.
import { readFileSync } from "node:fs";
import { ROOT, SKIP, scanPaths, lineOf, stripComments, argSpan } from "./js-scan.mjs";

/** Trailing `(` required, so `color-mix(in oklch, …)` is a colour space, not a literal. */
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const HEX = /#[0-9a-f]{3,8}\b/gi;
/** All 148 CSS named colours. Omits the system keywords and
 * `transparent`/`currentColor`: no design decision, no drift. */
const NAMED = /\b(?:aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen)\b/gi;
/** Properties that accept a <color>. A bare keyword is not self-identifying the
 * way `#abc` or `rgb(` is, so without this `font-family: Gold Sans` reads as a
 * colour and so does the `tan()` in `calc(100px * tan(30deg))`. */
const COLOR_PROP = new Set(["color", "background", "background-image", "border", "border-image",
  "outline", "box-shadow", "text-shadow", "text-decoration", "column-rule", "fill", "stroke"]);
/** @param {string} p */
const takesColor = (p) =>
  p.endsWith("-color") || COLOR_PROP.has(p) ||
  /^border-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?$/.test(p);

/** @type {Array<["hex" | "fn" | "named", RegExp]>} scanned in this order, which fixes finding order */
const COLOR_SYNTAX = [["hex", HEX], ["fn", COLOR_FN], ["named", NAMED]];

const QUOTED = /"[^"]*"|'[^']*'/g;
const MIX = /color-mix\s*\(/gi;

/** Candidates per property family, filtered against what the tree defines, so
 * renaming a token changes the advice without touching this table.
 * @type {Array<[RegExp, string[]]>} */
const ADVICE = [
  [/^background(-color)?$/, ["--bg", "--bg-elev", "--bg-elev-2"]],
  [/^(color|caret-color)$/, ["--text", "--text-dim", "--accent", "--ok", "--warn", "--bad", "--info"]],
  [/^(border|outline)(-[a-z-]*)?$/, ["--hairline", "--line", "--accent"]],
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

/** Is this offset inside a region `re` matches? With `balanced`, the region runs
 * to the match's matching `)` rather than to the end of the match text.
 * `keep` filters a span on its own text.
 * @param {string} v @param {RegExp} re @param {boolean} [balanced]
 * @param {(text: string) => boolean} [keep]
 * @returns {(i: number) => boolean} */
function within(v, re, balanced, keep) {
  /** @type {Array<[number, number]>} */ const spans = [];
  for (const m of v.matchAll(re)) {
    const end = balanced ? argSpan(v, m.index + m[0].length - 1)?.end : m.index + m[0].length;
    if (end === undefined) continue;
    if (keep && !keep(v.slice(m.index, end))) continue;
    spans.push([m.index, end]);
  }
  return (i) => spans.some(([a, b]) => i >= a && i < b);
}

/** Colour literals in a declaration value. A font family named "Ivory" is not a
 * colour, so quoted text is skipped here rather than at each call site; bare
 * keywords additionally need a property that accepts one.
 * @param {string} prop @param {string} value */
function* colorLiterals(prop, value) {
  const inQuotes = within(value, QUOTED);
  for (const [kind, re] of COLOR_SYNTAX) {
    if (kind === "named" && !takesColor(prop)) continue;
    for (const m of value.matchAll(re)) {
      if (inQuotes(m.index)) continue;
      yield { kind, index: m.index, text: m[0].replace(/\($/, "") };
    }
  }
}

const files = scanPaths("**/*.css").filter((p) => !SKIP.test(p + "/"));
const html = scanPaths("**/*.html").filter((p) => !SKIP.test(p + "/"));
/** Read and parsed once; both passes below read this. The vocabulary must be
 * complete over the whole tree before the first message can name a token. */
const sheets = files.map((rel) => {
  const raw = readFileSync(new URL(rel, ROOT), "utf8");
  const css = stripCss(raw);
  return { rel, raw, css, decls: declarations(css) };
});

/** @type {Set<string>} every custom property defined in the tree */
const defined = new Set();
/** @type {Map<string, string>} colour literal (lowercased) → the token holding it */
const byValue = new Map();
/** @type {Set<string>} tokens whose value IS a colour, for advice that would
 * otherwise guess from the name and miss a token called `--rail` */
const colorTokens = new Set();
for (const { css, decls } of sheets) {
  // Only a `@layer tokens` file supplies advice. preview.css declares its own
  // palette under `@layer preview` and no component loads it, so advising
  // var(--page-bg) inside a component would name a property that resolves
  // nowhere — and check-css-vars, also tree-global, would pass it.
  const isTokenLayer = /@layer\s+tokens\s*\{/.test(css);
  for (const d of decls) {
    if (!d.prop.startsWith("--")) continue;
    defined.add(d.prop);
    if (!isTokenLayer) continue;
    for (const lit of colorLiterals("color", d.value)) {
      colorTokens.add(d.prop);
      const key = lit.text.toLowerCase();
      if (lit.kind === "hex" && !byValue.has(key)) byValue.set(key, d.prop);
    }
  }
}

/** @param {string} prop @param {string} literal */
function adviceFor(prop, literal) {
  const exact = byValue.get(literal.toLowerCase());
  if (exact) return `that value is already ${exact} — use var(${exact})`;
  const family = ADVICE.find(([re]) => re.test(prop))?.[1].filter((t) => defined.has(t)) ?? [];
  if (family.length) return `use one of ${family.join(", ")}`;
  // Naming the wrong token is worse than admitting the gap.
  return colorTokens.size
    ? `no token for ${prop} here; colours defined in this tree: ${[...colorTokens].slice(0, 8).join(", ")} — reuse one or define a new token at its definition site`
    : "define it as a custom property (tokens.css) and use var(--…) here";
}

/** @type {Array<{file: string, line: number, rule: string, msg: string}>} */
const findings = [];

/** Records a finding unless a `gate-allow` marker suppresses that rule — on the
 * line, or anywhere in the first 10 for the whole file.
 * @param {string} rel @param {string} raw */
function flagger(rel, raw) {
  /** @type {Set<string>} */ const fileWide = new Set();
  /** @type {Map<number, Set<string>>} */ const perLine = new Map();
  raw.split("\n").forEach((ln, i) => {
    for (const m of ln.matchAll(/(?:\/\*|<!--)\s*gate-allow:\s*([\w-,\s]+?)\s*(?:\*\/|-->)/g)) {
      const rules = m[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (i < 10) for (const r of rules) fileWide.add(r);
      const here = perLine.get(i + 1) ?? new Set();
      for (const r of rules) here.add(r);
      perLine.set(i + 1, here);
    }
  });
  return (/** @type {number} */ line, /** @type {string} */ rule, /** @type {string} */ msg) => {
    if (fileWide.has(rule) || perLine.get(line)?.has(rule)) return;
    findings.push({ file: rel, line, rule, msg });
  };
}

for (const { rel, raw, css, decls } of sheets) {
  const flag = flagger(rel, raw);

  for (const d of decls) {
    if (d.prop.startsWith("--")) continue;   // the definition site: the one legal place
    const inDerivation = within(d.value, MIX, true, (t) => t.includes("var(--"));
    for (const lit of colorLiterals(d.prop, d.value)) {
      // black/white mixed INTO a token are this stack's darken/lighten
      // operators (reference/css.md). A mix carrying no token is a palette
      // choice wearing a mix for a hat, so it still counts.
      if (lit.kind === "named" && /^(?:black|white)$/i.test(lit.text) && inDerivation(lit.index)) continue;
      flag(lineOf(css, d.at + lit.index), "raw-color",
        `${d.prop}: ${lit.text} — raw colour outside a token definition; ${adviceFor(d.prop, lit.text)}`);
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
  const text = stripComments(raw, true);
  const flag = flagger(rel, raw);
  for (const m of text.matchAll(/\sstyle\s*=\s*["']/g)) {
    flag(lineOf(text, m.index), "inline-style",
      'style="…" in a template — put the rule in the component .css, and pass anything dynamic as a custom property');
  }
}

if (findings.length) {
  console.error(`✖ ${findings.length} CSS token violation${findings.length === 1 ? "" : "s"} (rules: reference/css.md):`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.rule}  ${f.msg}`);
  process.exit(1);
}
console.log(`✓ check-css-tokens: ${files.length} stylesheets + ${html.length} templates clean against ${defined.size} defined custom properties (raw-color, inline-style, unscoped-css, viewport-media)`);
