#!/usr/bin/env node
// canonical source: vanilla-web/tools/check-conventions.mjs@a1b4cb8 — vendored copy, do not edit here
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
// Escapes (both visible in the diff, never silent — and both only count when
// COMMENT-BORNE: a marker inside a string literal suppresses nothing):
//   // static-render               trailing on the line — the semantic alias
//                                  for raw-swap ONLY (it documents WHY: a
//                                  deliberate one-shot render); suppresses no
//                                  other rule.
//   // gate-allow: <rule>[, rule]  trailing on the line — suppresses the named
//                                  rule(s) there (e.g. // gate-allow: html-string).
//   // gate-allow: <rule>[, rule]  ANYWHERE in the file's first ~10 lines —
//                                  suppresses the named rule(s) for the WHOLE
//                                  file (e.g. a demo/prototype script whose every
//                                  listener legitimately needs the same escape,
//                                  in place of one inline comment per call site).
//
// The canonical lib files are exempt (they ARE the sanctioned helpers):
// templates.js, shell.js, store.js, state.js, api-client.js, format.js, live.js,
// preview.js, serve.mjs, and everything under lib/, tools/, previews/, plus
// node_modules/ and testing/. Zero-dep; same shape + exit contract as
// check-css-vars: file:line findings, exit 1 on any finding.
import { globSync, readFileSync } from "node:fs";
import { lineOf, stripComments, argSpan, splitTop, commentMatch } from "./js-scan.mjs";

const ROOT = new URL("../", import.meta.url); // tools/ sits in the app/skill root
const SKIP_DIRS = /(^|\/)(node_modules|testing|tools|previews|lib)\//;
const SKIP_FILES = new Set(["templates.js", "shell.js", "store.js", "state.js", "api-client.js", "format.js", "live.js", "preview.js", "serve.mjs"]);
const files = globSync("**/*.js", { cwd: ROOT }).filter((p) => {
  if (SKIP_DIRS.test(p + "/")) return false;
  return !SKIP_FILES.has(p.split("/").pop() ?? "");
});

const GATE_ALLOW_RE = /\/\/\s*gate-allow:\s*([\w-,\s]+)/g;
const STATIC_RENDER_RE = /\/\/\s*static-render\b/g;

/** File-level suppression: a `// gate-allow: <rule>[, rule]` ANYWHERE in the
 * first ~10 lines suppresses those rule(s) for every finding in the file — for
 * a file whose every relevant call needs the same escape (see vc-elements.js's
 * header prose for the canonical example), rather than one inline comment per
 * call site. Only comment-borne markers count (commentMatch, js-scan.mjs).
 * @param {string[]} rawLines @param {string[]} strippedLines */
function fileLevelAllow(rawLines, strippedLines) {
  /** @type {Set<string>} */ const allowed = new Set();
  for (let i = 0; i < Math.min(10, rawLines.length); i++) {
    const m = commentMatch(rawLines[i], strippedLines[i] ?? "", GATE_ALLOW_RE);
    if (m) for (const r of m[1].split(",")) allowed.add(r.trim());
  }
  return allowed;
}

/** @type {Array<{file: string, line: number, rule: string, msg: string}>} */
const findings = [];

for (const rel of files) {
  const raw = readFileSync(new URL(rel, ROOT), "utf8");
  const rawLines = raw.split("\n");
  const text = stripComments(raw);
  const strippedLines = text.split("\n"); // offsets preserved → same line indices as rawLines
  const fileAllowed = fileLevelAllow(rawLines, strippedLines);

  /** Suppressed on this 1-based line? `// gate-allow: a, b` names rules
   * (trailing on the line, or file-wide from the header); `// static-render`
   * is the raw-swap-specific escape. Markers only count when comment-borne —
   * one inside a string literal is code, not an escape.
   * @param {number} ln @param {string} rule */
  const suppressed = (ln, rule) => {
    if (fileAllowed.has(rule)) return true;
    const rawL = rawLines[ln - 1] ?? "", strippedL = strippedLines[ln - 1] ?? "";
    if (rule === "raw-swap" && commentMatch(rawL, strippedL, STATIC_RENDER_RE)) return true;
    const m = commentMatch(rawL, strippedL, GATE_ALLOW_RE);
    return !!m && m[1].split(",").map((s) => s.trim()).includes(rule);
  };

  /** @param {number} idx @param {number} endIdx @param {string} rule @param {string} msg */
  const flag = (idx, endIdx, rule, msg) => {
    const start = lineOf(text, idx), end = lineOf(text, endIdx);
    if (!suppressed(start, rule) && !suppressed(end, rule)) {
      findings.push({ file: rel, line: start, rule, msg });
    }
  };

  // signal-listener — the OPTIONS argument (3rd+) must carry `signal` or
  // `once: true`; a bare two-arg call leaks across re-mounts. Split on
  // top-level commas so a callback body merely MENTIONING `signal` can't pass.
  for (const m of text.matchAll(/\baddEventListener\s*\(/g)) {
    const span = argSpan(text, m.index + m[0].length - 1);
    if (!span) continue;
    const options = splitTop(span.args).slice(2);
    if (options.some((a) => /\bsignal\b/.test(a) || /\bonce\s*:\s*true\b/.test(a))) continue;
    flag(m.index, span.end, "signal-listener",
      "addEventListener without { signal } (or { once: true }) in the options — leaks across re-mounts");
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
