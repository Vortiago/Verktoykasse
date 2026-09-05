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
//   canonical source: <skill>/<path>@<rev> sha256:<hash>   (sync-from-web.sh /
//     new-app.mjs)
//   from vanilla-components[/<path>]@<rev> sha256:<hash>   (vendor.sh; old
//     stamps lack the path — it is reconstructed from the file's own location:
//     tokens.css / tones.css at the skill root, else components/<dir>/<file>)
//
// The hash is of the canon bytes the copy carries, and it is what decides
// (docs/adr/0004): no command run at sync time can name the commit the bytes end
// up in, because it does not exist yet, so the rev is provenance for a human and
// a fallback for a stamp written before the hash existed.
//
// Each stamped file (stamp-stripped) is compared against the toolkit checkout:
//   up-to-date  identical to current canon, under a stamp recording those bytes
//   stale       canon moved and the copy is untouched (its bytes hash to the
//               stamp), or the body is current under a stamp naming other bytes
//               — safe to re-copy or re-stamp (the exact command is printed);
//               never an error
//   forked      copy differs from what its stamp says it carries — the
//               extend-don't-fork violation, loud, with a diffstat
//
// Exit non-zero on forked only, so an app can gate on this without staleness
// blocking commits. Zero-dep (git does the history reads).
import { globSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
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

/** @param {string} text */
const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

/** Parse a stamp out of a file's first lines. Dialect order matters: the
 * pathful vendor.sh form must win over the pathless one. `sha256` is absent on a
 * stamp written before ADR 0004, and those classify through `rev` instead.
 * @param {string} head @param {string} rel
 * @returns {{repoPath: string, rev: string, sha256?: string, dialect: "sync"|"vendor"} | null} */
function parseStamp(head, rel) {
  let m = head.match(/canonical source:\s*([\w-]+)\/(\S+?)@(\S+)(?:\s+sha256:([0-9a-f]{64}))?/);
  if (m) return { repoPath: `${m[1]}/${m[2]}`, rev: m[3], sha256: m[4], dialect: "sync" };
  m = head.match(/from vanilla-components\/(\S+?)@(\w+)(?:\s+sha256:([0-9a-f]{64}))?/);
  if (m) return { repoPath: `vanilla-components/${m[1]}`, rev: m[2], sha256: m[3], dialect: "vendor" };
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

/** The exact re-copy command for a stale file. The sync dialect has no re-stamping
 * tool on the app side, so print the exact values the new stamp needs, the hash
 * above all, since that is what the next run classifies on.
 * @param {string} rel @param {{repoPath: string, dialect: string}} s
 * @param {string} canon - current canon text, for the hash to record */
function recopyCmd(rel, s, canon) {
  if (s.dialect === "vendor") {
    const base = basename(rel);
    const what = base === "tokens.css" ? "tokens" : base === "tones.css" ? "tones" : basename(dirname(rel));
    const dest = base === "tokens.css" || base === "tones.css" ? dirname(rel) : dirname(dirname(rel));
    return `${join(TK, "vanilla-components", "vendor.sh")} ${what} ${dest || "."}`;
  }
  return `cp ${join(TK, s.repoPath)} ${rel}   # then set the stamp to @${headRev} sha256:${sha256(canon)}`;
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
    // Matching bytes are not a clean bill of health. The stamp is the only record
    // the NEXT run classifies on, and a re-copy that left the stamp line alone
    // records other bytes than the ones it now carries. Report it here or the
    // copy passes today and reads as `forked` the first time canon moves, which
    // is exactly the failure the hash replaced the rev to end. The remedy is the
    // stamp alone, so this is stale, never an error.
    const own = sha256(canon);
    if (stamp.sha256 === own) upToDate.push(`${rel}  (${stamp.repoPath}@${stamp.rev})`);
    else stale.push(`${rel}  ${stamp.repoPath} body is current, stamp records sha256:${stamp.sha256 ?? "none"} for bytes that hash to sha256:${own}\n      ${recopyCmd(rel, stamp, canon)}`);
    continue;
  }

  // The hash decides when the stamp carries one, and it decides from the copy
  // alone — no git read at all. The rev path below stays for a stamp written
  // before ADR 0004, and it is exactly the path this issue proves unreliable: it
  // reads an untouched copy as forked as soon as canon moves. Run at most once
  // per file: the hash-less path asks twice, first to classify and again for a
  // diff basis.
  /** @type {ReturnType<typeof git> | null} */ let shown = null;
  const original = () => {
    shown ??= git(["show", `${stamp.rev}:${stamp.repoPath}`]);
    return shown.status === 0 ? shown.stdout : null;
  };
  const untouched = stamp.sha256 ? sha256(stripped) === stamp.sha256 : stripped === original();
  if (untouched) {
    if (canon === null) {
      // Untouched copy, but canon is gone from the toolkit's working tree —
      // moved or renamed; a re-copy needs a human to find the new home.
      forked.push(`${rel}  canon ${stamp.repoPath} missing from toolkit — moved/renamed? (copy itself is untouched at @${stamp.rev})`);
    } else {
      stale.push(`${rel}  ${stamp.repoPath} @${stamp.rev} → @${headRev}\n      ${recopyCmd(rel, stamp, canon)}`);
    }
    continue;
  }

  // Only a forked copy needs a diff basis, so the git read waits until here: the
  // stale path above is the common one after a canon bump, and it now costs no
  // subprocess. A rev only names the copy's bytes when the bytes at that rev hash
  // to the stamp — anything else must not be called "the stamped original".
  const stampedOriginal = original();
  const originalTrusted = stampedOriginal !== null && (!stamp.sha256 || sha256(stampedOriginal) === stamp.sha256);
  const baseText = originalTrusted ? stampedOriginal : canon;
  let stat = "";
  if (baseText !== null) {
    const a = join(tmp, "stamped-original"), b = join(tmp, "local-copy");
    writeFileSync(a, baseText); writeFileSync(b, stripped);
    const num = spawnSync("git", ["diff", "--no-index", "--numstat", a, b], { encoding: "utf8" });
    const parts = num.stdout.trim().split("\t");
    stat = parts.length >= 2 ? `+${parts[0]} -${parts[1]} lines` : "differs";
  }
  const vs = originalTrusted ? `vs stamped original @${stamp.rev}`
    : canon !== null ? `vs current canon (@${stamp.rev} does not carry the stamped bytes — could also be stale)`
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
  console.log(`~ stale (${stale.length}) — canon moved, or the stamp names other bytes; re-copy:`);
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
