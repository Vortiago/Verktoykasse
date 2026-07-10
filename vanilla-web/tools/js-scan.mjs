// @ts-check
// js-scan — shared quote/backtick/${}-aware scanning helpers for the check-*.mjs
// static checkers (check-conventions.mjs, check-slots.mjs). Not a gate half
// itself — check.mjs discovers halves via a `tools/check-*.mjs` glob, and this
// filename doesn't match that prefix, so it's never misdetected as one.

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
 * need the text can destructure `{ args }`).
 * @param {string} text @param {number} openIdx
 * @returns {{args: string, end: number} | null} */
export function argSpan(text, openIdx) {
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
      else if (c === ")" || c === "}" || c === "]") { depth--; if (depth === 0) return { args: text.slice(openIdx + 1, i), end: i + 1 }; }
      if (top === "${" && c === "}" && depth >= 0) ctx.pop();
    }
  }
  return null;
}
