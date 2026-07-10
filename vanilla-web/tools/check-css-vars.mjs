#!/usr/bin/env node
// @ts-check
// check-css-vars — the no-build stack's guard for CSS custom properties. `tsc`
// checks the JS; nothing checks `var(--x)`, so an undefined custom property
// fails SILENTLY — it just falls back (a transparent popover, a missing colour).
// This flags any *required* `var(--x)` whose name is never defined, where
// "defined" means a CSS declaration (`--x:`) OR a JS `setProperty("--x", …)` (so
// legit inline-set props like --sev / --bell / --host-accent don't false-positive).
// A `var(--x, fallback)` is exempt: an explicit fallback means it CAN'T fail
// silently, and it's the stack's idiom for an intentionally-optional var.
// node_modules/ and testing/ (deliberately-weird fixtures, vendored third-party
// CSS) are skipped — same SKIP as check-slots.mjs/check-conventions.mjs.
// Zero-dep; meant to run in the same gate as tsc. Exit 1 on any undefined var.
import { globSync, readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url); // tools/ sits in the app/skill root
const SKIP = /(^|\/)(node_modules|testing)\//;
const files = ["**/*.css", "**/*.js"]
  .flatMap((p) => globSync(p, { cwd: ROOT }))
  .filter((p) => !SKIP.test(p + "/"));

/** Names with a definition somewhere (CSS decl or JS setProperty). @type {Set<string>} */
const defined = new Set();
/** Required `var(--x)` sites (no fallback), kept with a location for the report.
 * @type {Array<{name:string,file:string,line:number}>} */
const usages = [];
let total = 0; // every var(--…) site, fallback or not — for the summary line

for (const rel of files) {
  const text = readFileSync(new URL(rel, ROOT), "utf8");
  // Definitions: a CSS declaration `--x:` (usages `var(--x)` have no following
  // colon, so they never match) and a JS `setProperty("--x", …)`.
  for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:/gi)) defined.add(m[1]);
  for (const m of text.matchAll(/setProperty\(\s*["'`](--[a-z0-9-]+)/gi)) defined.add(m[1]);
  // Usages: every `var(--x)` (in CSS and in JS strings alike), with a line number.
  // A comma right after the name means it has a fallback → optional, not required.
  text.split("\n").forEach((ln, i) => {
    for (const m of ln.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,)?/gi)) {
      total++;
      if (!m[2]) usages.push({ name: m[1], file: rel, line: i + 1 });
    }
  });
}

const missing = usages.filter((u) => !defined.has(u.name));
if (missing.length) {
  console.error(`✖ ${missing.length} undefined CSS custom propert${missing.length === 1 ? "y" : "ies"} (typo, or token not defined in tokens.css):`);
  for (const u of missing) console.error(`  ${u.file}:${u.line}  ${u.name}`);
  process.exit(1);
}
console.log(`✓ check-css-vars: all ${total} var(--…) usages resolve or carry a fallback (${defined.size} custom properties defined across ${files.length} files)`);
