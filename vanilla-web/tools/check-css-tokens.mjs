#!/usr/bin/env node
// @ts-check
// check-css-tokens — the CSS half of "an agent needs a closed vocabulary".
//
// check-css-vars guards the OTHER direction: a `var(--x)` naming a property
// nobody defines. This one guards the direction an LLM actually fails in. Asked
// for "a subtle accent border", a model writes fluent, runnable CSS with a hex
// it invented, because it knows CSS syntax perfectly and knows THIS project's
// tokens not at all. Nothing about that CSS is broken, so no checker that looks
// for breakage sees it; the design just drifts one plausible value at a time.
// The rules below are the mechanically checkable half of reference/css.md:
//
//   raw-color      a color literal (hex, rgb()/hsl()/oklch()/…, or a named
//                  colour) in a declaration value. A raw colour is legal in
//                  exactly one place — the value of a custom property, i.e. the
//                  definition site — so reaching for a new colour means naming
//                  it in tokens.css first. That is the whole closed-vocabulary
//                  rule, and it needs no allow-list to state.
//   inline-style   a `style="…"` attribute in a .html template — reference/css.md's
//                  "never inline style= in templates (a CSS var + class instead)".
//   unscoped-css   a components/ or views/ stylesheet with no `@scope` — its
//                  rules can leak to every other view on the page.
//   viewport-media a dimension `@media` (width/height/aspect-ratio) in a
//                  components/ stylesheet — a component sizes off `@container`,
//                  not off the viewport it happens to be in today.
//
// Every finding names the token to use INSTEAD, resolved against the properties
// this tree actually defines — an exact value match when the literal is already
// a token ("#1a64d6 is --accent"), otherwise the tokens defined for that
// property family. A checker that only says "no" costs an agent a round-trip to
// go discover the vocabulary; one that answers "use var(--accent)" closes the
// loop in the same pass, which is the point of running it in the gate at all.
//
// Escapes (comment-borne only, same dialect as check-conventions.mjs):
//   /* gate-allow: <rule>[, rule] */  on the finding's line, or anywhere in the
//   file's first ~10 lines for the whole file.
//
// node_modules/ and testing/ are skipped (shared SKIP). Zero-dep; same shape +
// exit contract as its sibling checkers: file:line findings, exit 1 on any.
import { readFileSync } from "node:fs";
import { ROOT, SKIP, scanPaths, lineOf } from "./js-scan.mjs";

/** Colour functions. `oklch(` with the paren, so `color-mix(in oklch, …)` — the
 * stack's own idiom for deriving a shade — is not a literal. */
const COLOR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const HEX = /#[0-9a-f]{3,8}\b/gi;
/** Named colours worth catching: the ones a model reaches for by reflex. The
 * system-colour keywords (Canvas, ButtonText) and the non-colours
 * (transparent, currentColor, inherit) are deliberately absent — they carry no
 * design decision, so they are not drift. */
const NAMED = /\b(?:red|green|blue|yellow|orange|purple|pink|brown|gray|grey|black|white|cyan|magenta|lime|navy|teal|olive|maroon|silver|gold|violet|indigo|crimson|salmon|khaki|tomato|orchid|plum|beige|ivory|coral|azure|aqua|fuchsia)\b/gi;

/** Which token family answers which property. Names are candidates, filtered
 * below against what the tree actually defines, so a renamed token changes the
 * advice without touching this table. @type {Array<[RegExp, string[]]>} */
const ADVICE = [
  [/^(background|background-color)$/, ["--bg", "--bg-elev", "--bg-elev-2"]],
  [/^(color|caret-color)$/, ["--text", "--text-dim", "--accent", "--ok", "--warn", "--bad", "--info"]],
  [/^(border|border-.*color|border-[a-z-]*|outline|outline-color)$/, ["--hairline", "--line", "--accent"]],
  [/^box-shadow$/, ["--shadow-1", "--shadow-2", "--shadow-3"]],
  [/^(fill|stroke)$/, ["--text", "--text-dim", "--accent"]],
  [/^(text-decoration-color|column-rule-color|accent-color)$/, ["--accent", "--text-dim"]],
];

/** Blank out `/* … *\/` comments, preserving offsets (so line numbers and the
 * comment-borne escape test both stay true). @param {string} text */
const stripCss = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

/** Every `prop: value` declaration in a stylesheet, with the offset its value
 * starts at. Walks rather than regexes the file: a selector (`a:hover`) is the
 * text before a `{` and a declaration is the text before a `;` or `}`, which is
 * the one distinction a single pattern over CSS cannot make.
 * @param {string} css comment-stripped source
 * @returns {Array<{prop: string, value: string, at: number}>} */
function declarations(css) {
  /** @type {Array<{prop: string, value: string, at: number}>} */ const out = [];
  let start = 0, depth = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c !== "{" && c !== "}" && c !== ";") continue;
    if (c === "{") { depth++; start = i + 1; continue; }   // prelude, not a declaration
    if (depth > 0) {
      const chunk = css.slice(start, i);
      const colon = chunk.indexOf(":");
      if (colon !== -1) {
        const prop = chunk.slice(0, colon).trim();
        // A declaration's property is a plain ident (or a custom property).
        // Anything with a space, bracket or paren is a stray prelude fragment.
        if (/^(--)?[a-z][a-z0-9-]*$/i.test(prop)) {
          out.push({ prop, value: chunk.slice(colon + 1), at: start + colon + 1 });
        }
      }
    }
    if (c === "}") depth = Math.max(0, depth - 1);
    start = i + 1;
  }
  return out;
}

/** Spans of a declaration value that are inside quotes — a font family named
 * "Gold Sans" is not a colour. @param {string} v */
function quoted(v) {
  /** @type {Array<[number, number]>} */ const spans = [];
  for (const m of v.matchAll(/"[^"]*"|'[^']*'/g)) spans.push([m.index, m.index + m[0].length]);
  return spans;
}

/** Spans covered by a `color-mix(…)`, balanced-paren. Inside one, the keyword
 * endpoints `black`/`white` are the stack's sanctioned way to DERIVE a shade
 * ("color-mix(in srgb, var(--accent) 88%, black)" — reference/css.md), not a
 * palette value someone invented, so NAMED does not fire there. A hex or a
 * second colour function inside the mix still does: that is a literal wearing a
 * mix for a hat. @param {string} v */
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

// ── Pass 1: the vocabulary — every custom property defined anywhere in the
// tree, so advice names tokens that exist rather than tokens it hopes for.
/** @type {Set<string>} every defined custom property */
const defined = new Set();
/** @type {Map<string, string>} colour literal (lowercased) → token that holds it */
const byValue = new Map();
/** Tokens whose value IS a colour. The fallback advice lists these rather than
 * guessing from the name, so a token named `--rail` still gets offered.
 * @type {string[]} */
const colorTokens = [];
for (const rel of files) {
  const css = stripCss(readFileSync(new URL(rel, ROOT), "utf8"));
  for (const d of declarations(css)) {
    if (!d.prop.startsWith("--")) continue;
    defined.add(d.prop);
    const skip = quoted(d.value);   // a font family named "Ivory" is not a colour
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

/** The advice line for one finding: the token that already holds this exact
 * value if there is one, else the defined tokens for the property's family,
 * else the instruction to name it at the definition site.
 * @param {string} prop @param {string} literal */
function adviceFor(prop, literal) {
  const exact = byValue.get(literal.toLowerCase());
  if (exact) return `that value is already ${exact} — use var(${exact})`;
  const family = ADVICE.find(([re]) => re.test(prop))?.[1].filter((t) => defined.has(t)) ?? [];
  if (family.length) return `use one of ${family.join(", ")}`;
  // No token for this property's family in this tree. Offer the properties that
  // DO hold a colour rather than a same-shaped guess from the name — advice that
  // names the wrong token is worse than advice that admits the gap.
  return colorTokens.length
    ? `no token for ${prop} here; colours defined in this tree: ${colorTokens.slice(0, 8).join(", ")} — reuse one or define a new token at its definition site`
    : "define it as a custom property (tokens.css) and use var(--…) here";
}

/** @type {Array<{file: string, line: number, rule: string, msg: string}>} */
const findings = [];
/** Comment-borne `gate-allow` set for a file: the header form (first ~10 lines)
 * plus a per-line lookup. @param {string} raw */
function allowances(raw) {
  const lines = raw.split("\n");
  /** @type {Set<string>} */ const file = new Set();
  /** @type {Map<number, Set<string>>} */ const perLine = new Map();
  lines.forEach((ln, i) => {
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

  // raw-color — a colour literal anywhere but a custom property's own value.
  for (const d of declarations(css)) {
    if (d.prop.startsWith("--")) continue;             // the definition site: legal
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

  // unscoped-css / viewport-media — component + view stylesheets only.
  const isComponent = /(^|\/)components\//.test(rel);
  if ((isComponent || /(^|\/)views\//.test(rel)) && /\{/.test(css) && !/@scope\b/.test(css)) {
    flag(1, "unscoped-css",
      "component/view stylesheet with no @scope — wrap its rules in @scope (.<root-class>) so they cannot leak");
  }
  if (isComponent) {
    for (const m of css.matchAll(/@media[^{]*/g)) {
      if (!/\b(?:min-|max-)?(?:width|height|aspect-ratio)\b/.test(m[0])) continue; // feature query: fine
      flag(lineOf(css, m.index), "viewport-media",
        "dimension @media in a component — size off @container (the component's own width), not the viewport");
    }
  }
}

// inline-style — markup carries classes and custom properties, never a style="".
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
  console.error(`✖ ${findings.length} CSS token violation${findings.length === 1 ? "" : "s"} (see rule docs in tools/check-css-tokens.mjs):`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.rule}  ${f.msg}`);
  process.exit(1);
}
console.log(`✓ check-css-tokens: ${files.length} stylesheets + ${html.length} templates clean against ${defined.size} defined custom properties (raw-color, inline-style, unscoped-css, viewport-media)`);
