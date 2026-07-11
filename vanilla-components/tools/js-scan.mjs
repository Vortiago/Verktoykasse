// canonical source: vanilla-web/tools/js-scan.mjs@4dabf5c — vendored copy, do not edit here
// @ts-check
// js-scan — shared quote/backtick/${}-aware scanning helpers for the check-*.mjs
// static checkers (check-conventions.mjs, check-slots.mjs). Not a gate half
// itself — check.mjs discovers halves via a `tools/check-*.mjs` glob, and this
// filename doesn't match that prefix, so it's never misdetected as one.

/** tools/ sits in the app/skill root — every check-*.mjs resolves its file set
 * relative to this. Shared here (rather than re-declared per file) since it's
 * byte-identical across check-css-vars/check-slots/check-conventions. */
export const ROOT = new URL("../", import.meta.url);
/** Base skip: node_modules/ (dependencies) and testing/ (deliberately-weird
 * fixtures, vendored third-party CSS) never belong in a source scan. Some
 * checkers extend this with their own extra skipped dirs. */
export const SKIP = /(^|\/)(node_modules|testing)\//;

/** 1-based line of an index into text. @param {string} text @param {number} idx */
export const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;

/** Blank out comments preserving offsets, so doc-comment examples don't count
 * as matches. HTML mode (`isHtml`) strips `<!-- -->` with a plain regex; JS
 * mode (default) runs a quote/backtick/${}-aware state machine so comment
 * markers inside strings/templates are left alone.
 * @param {string} text @param {boolean} [isHtml] */
export function stripComments(text, isHtml) {
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

/** Balanced argument span of a call from its `(` at openIdx to its matching
 * `)`, skipping strings/templates. Null when unterminated. Returns both the
 * args text and the index just past the closing paren (callers that only
 * need the text can destructure `{ args }`). Entering `${` records the current
 * bracket depth; the `}` at that recorded depth closes the interpolation
 * (context-pop only — it never opened a bracket, so it must not close one).
 * @param {string} text @param {number} openIdx
 * @returns {{args: string, end: number} | null} */
export function argSpan(text, openIdx) {
  let depth = 0;
  /** @type {string[]} */ const ctx = [];
  /** @type {number[]} */ const interpDepth = []; // bracket depth at each `${` entry
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i], top = ctx[ctx.length - 1];
    if (top === '"' || top === "'") {
      if (c === "\\") i++;
      else if (c === top || c === "\n") ctx.pop();
    } else if (top === "`") {
      if (c === "\\") i++;
      else if (c === "`") ctx.pop();
      else if (c === "$" && text[i + 1] === "{") { ctx.push("${"); interpDepth.push(depth); i++; }
    } else {
      if (c === '"' || c === "'" || c === "`") ctx.push(c);
      else if (c === "(" || c === "{" || c === "[") depth++;
      else if (c === ")" || c === "}" || c === "]") {
        if (c === "}" && top === "${" && depth === interpDepth[interpDepth.length - 1]) { ctx.pop(); interpDepth.pop(); }
        else { depth--; if (depth === 0) return { args: text.slice(openIdx + 1, i), end: i + 1 }; }
      }
    }
  }
  return null;
}

/** Split a call's argument span (argSpan().args) on its TOP-LEVEL commas —
 * commas inside strings, templates (incl. `${}` interpolations) or nested
 * ()/{}/[] belong to one argument. A blank span → []. Same interpolation
 * handling as argSpan.
 * @param {string} args @returns {string[]} */
export function splitTop(args) {
  /** @type {string[]} */ const out = [];
  let depth = 0, start = 0;
  /** @type {string[]} */ const ctx = [];
  /** @type {number[]} */ const interpDepth = [];
  for (let i = 0; i < args.length; i++) {
    const c = args[i], top = ctx[ctx.length - 1];
    if (top === '"' || top === "'") {
      if (c === "\\") i++;
      else if (c === top || c === "\n") ctx.pop();
    } else if (top === "`") {
      if (c === "\\") i++;
      else if (c === "`") ctx.pop();
      else if (c === "$" && args[i + 1] === "{") { ctx.push("${"); interpDepth.push(depth); i++; }
    } else {
      if (c === '"' || c === "'" || c === "`") ctx.push(c);
      else if (c === "(" || c === "{" || c === "[") depth++;
      else if (c === ")" || c === "}" || c === "]") {
        if (c === "}" && top === "${" && depth === interpDepth[interpDepth.length - 1]) { ctx.pop(); interpDepth.pop(); }
        else depth--;
      } else if (c === "," && depth === 0) { out.push(args.slice(start, i)); start = i + 1; }
    }
  }
  const last = args.slice(start);
  if (out.length || last.trim()) out.push(last);
  return out;
}

/** First COMMENT-BORNE match of global regex `re` in one raw source line: a
 * match whose text was blanked in the comment-stripped copy of that line
 * (stripComments preserves offsets — comment chars become spaces, string
 * content survives). Guards suppression markers: a `// gate-allow:` inside a
 * string literal must not suppress anything.
 * @param {string} raw @param {string} stripped @param {RegExp} re
 * @returns {RegExpExecArray | null} */
export function commentMatch(raw, stripped, re) {
  for (const m of raw.matchAll(re)) {
    if (stripped[m.index] !== raw[m.index]) return /** @type {RegExpExecArray} */ (m);
  }
  return null;
}
