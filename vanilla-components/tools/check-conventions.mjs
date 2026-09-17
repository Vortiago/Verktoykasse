#!/usr/bin/env node
// canonical source: vanilla-web/tools/check-conventions.mjs@773a55e sha256:2ea0cf0d3576cac68831c52f7fbaa230ce68f46fb3a3c6888678a4bd59339465 - vendored copy, do not edit here
// @ts-check
// check-conventions — the mechanically checkable SKILL.md invariants, as gate
// failures. Three rules over app/component/view .js; what each one protects is
// in SKILL.md ("Invariants") and reference/interactivity.md:
//
//   signal-listener  addEventListener with no { signal } / { once: true }
//   html-string      innerHTML / outerHTML / insertAdjacentHTML / DOMParser
//   raw-swap         replaceChildren outside the sanctioned helpers
//
// Escapes, comment-borne only (one inside a string literal suppresses nothing):
//   // static-render               raw-swap only — a deliberate one-shot render
//   // gate-allow: <rule>[, rule]  trailing on the line, or in the first ~10
//                                  lines for the whole file
//
// The sanctioned helpers are exempt, since they are what the rules point at:
// the SKIP_FILES list below, plus lib/, tools/, previews/.
import { readFileSync } from "node:fs";
import { ROOT, SKIP, scanPaths, lineOf, stripComments, argSpan, splitTop, commentMatch } from "./js-scan.mjs";

// This checker additionally skips tools/, previews/, and lib/ (the sanctioned
// helpers live there) on top of the shared node_modules/testing base. Both
// regexes, and the basename split below, are `/`-shaped: that is what scanPaths
// guarantees the paths are, and js-scan.mjs says why it has to.
const SKIP_EXTRA_DIRS = /(^|\/)(tools|previews|lib)\//;
const SKIP_FILES = new Set(["templates.js", "render.js", "chrome.js", "shell.js", "store.js", "state.js", "api-client.js", "format.js", "live.js", "preview.js", "preview-source.js", "serve.mjs"]);
const files = scanPaths("**/*.js").filter((p) => {
  if (SKIP.test(p + "/") || SKIP_EXTRA_DIRS.test(p + "/")) return false;
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

  // raw-swap — region swaps go through renderRegion (lib/render.js) / mount
  // (lib/templates.js); a deliberate one-shot render opts out with a trailing
  // `// static-render`.
  for (const m of text.matchAll(/\.replaceChildren\s*\(/g)) {
    flag(m.index, m.index, "raw-swap",
      "raw replaceChildren — use renderRegion (lib/render.js) or mount (lib/templates.js); `// static-render` to opt out");
  }
}

if (findings.length) {
  console.error(`✖ ${findings.length} convention violation${findings.length === 1 ? "" : "s"} (rules: SKILL.md invariants):`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.rule}  ${f.msg}`);
  process.exit(1);
}
console.log(`✓ check-conventions: ${files.length} files clean (signal-listener, html-string, raw-swap)`);
