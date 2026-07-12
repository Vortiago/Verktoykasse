#!/usr/bin/env node
// @ts-check
// gate: off — needs a toolkit-path argument, so check.mjs skips it; run by hand.
// check-vendored — drift/staleness report for copy-verbatim consumers. The
// stamps vendor.sh / sync-from-web.sh / new-app.mjs write are the metadata,
// `diff` is the engine, and the output is a to-do list — never an automatic
// write. Run FROM the app being checked:
//
//   node tools/check-vendored.mjs <toolkit-checkout-path>
//
// Scans the cwd for provenance stamps in both dialects:
//   canonical source: <skill>/<path>@<rev>     (sync-from-web.sh / new-app.mjs)
//   from vanilla-components[/<path>]@<rev>     (vendor.sh; old stamps lack the
//     path — it is reconstructed from the file's own location: tokens.css /
//     tones.css at the skill root, else components/<dir>/<file>)
//
// Each stamped file (stamp-stripped) is compared against the toolkit checkout:
//   up-to-date  identical to current canon
//   stale       canon moved, copy untouched at its stamped rev — safe to
//               re-copy (the exact command is printed); never an error
//   forked      copy differs from its stamped original (via `git -C <toolkit>
//               show <rev>:<path>`) — the extend-don't-fork violation, loud,
//               with a diffstat
//
// Exit non-zero on forked only, so an app can gate on this without staleness
// blocking commits. Zero-dep (git does the history reads).
import { globSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const toolkit = process.argv[2];
if (!toolkit) {
  console.error("usage: node tools/check-vendored.mjs <toolkit-checkout-path>");
  process.exit(2);
}
const TK = resolve(toolkit);

/** @param {string[]} args */
const git = (args) => spawnSync("git", ["-C", TK, ...args], { encoding: "utf8" });
if (git(["rev-parse", "--git-dir"]).status !== 0) {
  console.error(`not a git checkout: ${TK} (need one to read stamped revisions)`);
  process.exit(2);
}
const headRev = git(["rev-parse", "--short", "HEAD"]).stdout?.trim() || "unknown";

/** Parse a stamp out of a file's first lines. Dialect order matters: the
 * pathful vendor.sh form must win over the pathless one.
 * @param {string} head @param {string} rel
 * @returns {{repoPath: string, rev: string, dialect: "sync"|"vendor"} | null} */
function parseStamp(head, rel) {
  let m = head.match(/canonical source:\s*([\w-]+)\/(\S+?)@(\S+)/);
  if (m) return { repoPath: `${m[1]}/${m[2]}`, rev: m[3], dialect: "sync" };
  m = head.match(/from vanilla-components\/(\S+?)@(\w+)/);
  if (m) return { repoPath: `vanilla-components/${m[1]}`, rev: m[2], dialect: "vendor" };
  m = head.match(/from vanilla-components@(\w+)/);
  if (m) {
    const base = basename(rel);
    const path = base === "tokens.css" || base === "tones.css"
      ? base : `components/${basename(dirname(rel))}/${base}`;
    return { repoPath: `vanilla-components/${path}`, rev: m[1], dialect: "vendor" };
  }
  return null;
}

/** Drop the stamp line(s) — the full `<path>@<rev>` shape, NOT just the prefix
 * (this file's own body mentions the prefixes, and a vendored copy of it must
 * not strip code lines that canon keeps). @param {string} text */
const stripStamp = (text) => text.split("\n")
  .filter((l) => !/canonical source:\s*[\w-]+\/\S+@\S+|from vanilla-components(\/\S+)?@\w+/.test(l))
  .join("\n");

/** The exact re-copy command for a stale file. @param {string} rel
 * @param {{repoPath: string, dialect: string}} s */
function recopyCmd(rel, s) {
  if (s.dialect === "vendor") {
    const base = basename(rel);
    const what = base === "tokens.css" ? "tokens" : base === "tones.css" ? "tones" : basename(dirname(rel));
    const dest = base === "tokens.css" || base === "tones.css" ? dirname(rel) : dirname(dirname(rel));
    return `${join(TK, "vanilla-components", "vendor.sh")} ${what} ${dest || "."}`;
  }
  return `cp ${join(TK, s.repoPath)} ${rel}   # then update the stamp line to @${headRev}`;
}

/** @type {string[]} */ const upToDate = [];
/** @type {string[]} */ const stale = [];
/** @type {string[]} */ const forked = [];
const tmp = mkdtempSync(join(tmpdir(), "check-vendored-"));

const files = ["**/*.js", "**/*.mjs", "**/*.css", "**/*.html"]
  .flatMap((p) => globSync(p)).filter((p) => !/(^|\/)node_modules\//.test(p));

for (const rel of files) {
  const text = readFileSync(rel, "utf8");
  const stamp = parseStamp(text.split("\n").slice(0, 3).join("\n"), rel);
  if (!stamp) continue;

  const stripped = stripStamp(text);
  const canon = (() => {
    try { return readFileSync(join(TK, stamp.repoPath), "utf8"); } catch { return null; }
  })();
  if (stripped === canon) {
    upToDate.push(`${rel}  (${stamp.repoPath}@${stamp.rev})`);
    continue;
  }

  const shown = git(["show", `${stamp.rev}:${stamp.repoPath}`]);
  const original = shown.status === 0 ? shown.stdout : null;
  if (original !== null && stripped === original) {
    if (canon === null) {
      // Untouched copy, but canon is gone from the toolkit's working tree —
      // moved or renamed; a re-copy needs a human to find the new home.
      forked.push(`${rel}  canon ${stamp.repoPath} missing from toolkit — moved/renamed? (copy itself is untouched at @${stamp.rev})`);
    } else {
      stale.push(`${rel}  ${stamp.repoPath} @${stamp.rev} → @${headRev}\n      ${recopyCmd(rel, stamp)}`);
    }
    continue;
  }

  // Local edits: diffstat against the stamped original (or current canon when
  // the stamped rev isn't in this checkout's history).
  const baseText = original ?? canon;
  let stat = "";
  if (baseText !== null) {
    const a = join(tmp, "stamped-original"), b = join(tmp, "local-copy");
    writeFileSync(a, baseText); writeFileSync(b, stripped);
    const num = spawnSync("git", ["diff", "--no-index", "--numstat", a, b], { encoding: "utf8" });
    const parts = num.stdout.trim().split("\t");
    stat = parts.length >= 2 ? `+${parts[0]} -${parts[1]} lines` : "differs";
  }
  const vs = original !== null ? `vs stamped original @${stamp.rev}`
    : canon !== null ? `vs current canon (@${stamp.rev} not in toolkit history — could also be stale)`
    : `(neither @${stamp.rev} nor a current ${stamp.repoPath} found in toolkit)`;
  forked.push(`${rel}  ${stat} ${vs}  (${stamp.repoPath})`);
}
rmSync(tmp, { recursive: true, force: true });

// ── Report ───────────────────────────────────────────────────────────────────
if (upToDate.length) {
  console.log(`✓ up-to-date (${upToDate.length})`);
  for (const l of upToDate) console.log(`    ${l}`);
}
if (stale.length) {
  console.log(`~ stale (${stale.length}) — canon moved, copy untouched; re-copy:`);
  for (const l of stale) console.log(`    ${l}`);
}
if (forked.length) {
  console.error(`✗ forked (${forked.length}) — local edits on a vendored copy (extend, don't fork):`);
  for (const l of forked) console.error(`    ${l}`);
  process.exit(1);
}
if (!upToDate.length && !stale.length) {
  console.log("✓ check-vendored: no provenance-stamped files under " + process.cwd());
} else {
  console.log(`✓ check-vendored: nothing forked (${upToDate.length} up-to-date, ${stale.length} stale)`);
}
