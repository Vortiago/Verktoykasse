#!/usr/bin/env node
// canonical source: vanilla-web/tools/check-conventions.mjs@57e897c — vendored copy, do not edit here
// @ts-check
// check-conventions — turns the mechanically checkable SKILL.md invariants into
// gate failures. An LLM reads the skill once per session; this runs on every
// check. Three regex-grade rules over app/component/view .js code:
//
//   signal-listener  addEventListener without { signal } (or { once: true })
//                    in the options — the no-leaks invariant; a missed signal
//                    is the classic slow-OOM re-mount leak.
//   html-string      innerHTML= / outerHTML= / insertAdjacentHTML( / DOMParser —
//                    "no HTML strings in JS"; markup belongs in <template> .html.
//   raw-swap         raw replaceChildren( outside the sanctioned helpers —
//                    polled re-renders must go through renderRegion (innerHTML
//                    swaps are already caught by html-string).
//
// Escapes (both visible in the diff, never silent):
//   // static-render               trailing on the line — opts THAT line out of
//                                  raw-swap only (a deliberate one-shot render).
//   // gate-allow: <rule>[, rule]  trailing on the line — suppresses the named
//                                  rule(s) there (e.g. // gate-allow: html-string).
//
// The canonical lib files are exempt (they ARE the sanctioned helpers):
// templates.js, shell.js, store.js, state.js, api-client.js, format.js, live.js,
// preview.js, serve.mjs, and everything under lib/, tools/, previews/, plus
// node_modules/ and testing/. Zero-dep; same shape + exit contract as
// check-css-vars: file:line findings, exit 1 on any finding.
import { globSync, readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url); // tools/ sits in the app/skill root
const SKIP_DIRS = /(^|\/)(node_modules|testing|tools|previews|lib)\//;
const SKIP_FILES = new Set(["templates.js", "shell.js", "store.js", "state.js", "api-client.js", "format.js", "live.js", "preview.js", "serve.mjs"]);
const files = globSync("**/*.js", { cwd: ROOT }).filter((p) => {
  if (SKIP_DIRS.test(p + "/")) return false;
  return !SKIP_FILES.has(p.split("/").pop() ?? "");
});

/** 1-based line of an index into text. @param {string} text @param {number} idx */
const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;

/** Blank out // and /* *​/ comments preserving offsets (quote-aware), so
 * doc-comment examples don't trip the rules. Suppression comments are read
 * from the RAW lines before stripping. @param {string} text */
function stripComments(text) {
  let out = "";
  /** @type {string[]} */ const ctx = [];
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
    } else {
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

/** Balanced argument span of a call from its `(`, skipping strings. Null when
 * unterminated. Returns the args text + the index just past the closing paren.
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
      else if (c === ")" || c === "}" || c === "]") { depth--; if (depth === 0) return { args: text.slice(openIdx + 1, i), end: i + 1 }; }
      if (top === "${" && c === "}" && depth >= 0) ctx.pop();
    }
  }
  return null;
}

/** @type {Array<{file: string, line: number, rule: string, msg: string}>} */
const findings = [];

for (const rel of files) {
  const raw = readFileSync(new URL(rel, ROOT), "utf8");
  const rawLines = raw.split("\n");
  const text = stripComments(raw);

  /** Suppressed on this 1-based line? `// gate-allow: a, b` names rules;
   * `// static-render` is the raw-swap-specific escape.
   * @param {number} ln @param {string} rule */
  const suppressed = (ln, rule) => {
    const l = rawLines[ln - 1] ?? "";
    if (rule === "raw-swap" && /\/\/\s*static-render\b/.test(l)) return true;
    const m = l.match(/\/\/\s*gate-allow:\s*([\w-,\s]+)/);
    return !!m && m[1].split(",").map((s) => s.trim()).includes(rule);
  };

  /** @param {number} idx @param {number} endIdx @param {string} rule @param {string} msg */
  const flag = (idx, endIdx, rule, msg) => {
    const start = lineOf(text, idx), end = lineOf(text, endIdx);
    if (!suppressed(start, rule) && !suppressed(end, rule)) {
      findings.push({ file: rel, line: start, rule, msg });
    }
  };

  // signal-listener — the options (or anything in the args) must carry `signal`
  // or `once: true`; a bare two-arg call leaks across re-mounts.
  for (const m of text.matchAll(/\baddEventListener\s*\(/g)) {
    const span = argSpan(text, m.index + m[0].length - 1);
    if (!span) continue;
    if (/\bsignal\b/.test(span.args) || /\bonce\s*:\s*true\b/.test(span.args)) continue;
    flag(m.index, span.end, "signal-listener",
      "addEventListener without { signal } (or { once: true }) — leaks across re-mounts");
  }

  // html-string — markup belongs in <template> .html files, never JS strings.
  for (const m of text.matchAll(/\.innerHTML\s*=(?![=])/g)) {
    flag(m.index, m.index, "html-string", "innerHTML assignment — markup belongs in a <template> .html file");
  }
  for (const m of text.matchAll(/\.outerHTML\s*=(?![=])/g)) {
    flag(m.index, m.index, "html-string", "outerHTML assignment — markup belongs in a <template> .html file");
  }
  for (const m of text.matchAll(/\binsertAdjacentHTML\s*\(/g)) {
    flag(m.index, m.index, "html-string", "insertAdjacentHTML — markup belongs in a <template> .html file");
  }
  for (const m of text.matchAll(/\bDOMParser\b/g)) {
    flag(m.index, m.index, "html-string", "DOMParser — markup belongs in a <template> .html file");
  }

  // raw-swap — region swaps go through renderRegion/mount (lib/templates.js);
  // a deliberate one-shot render opts out with a trailing `// static-render`.
  for (const m of text.matchAll(/\.replaceChildren\s*\(/g)) {
    flag(m.index, m.index, "raw-swap",
      "raw replaceChildren — use renderRegion (or mount) from lib/templates.js; `// static-render` to opt out");
  }
}

if (findings.length) {
  console.error(`✖ ${findings.length} convention violation${findings.length === 1 ? "" : "s"} (see rule docs in tools/check-conventions.mjs):`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.rule}  ${f.msg}`);
  process.exit(1);
}
console.log(`✓ check-conventions: ${files.length} files clean (signal-listener, html-string, raw-swap)`);
