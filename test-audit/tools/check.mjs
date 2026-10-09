#!/usr/bin/env node
// canonical source: vanilla-web/tools/check.mjs@0c55dad sha256:706e8dab61d51f01d316bbae6c9f3d7afebbb290d919fd6caa5a4de9828e96cb - vendored copy, do not edit here
// @ts-check
// check — THE gate command. One thing to run, locally and in CI, from any skill
// or app dir that carries tools/:
//
//   node tools/check.mjs          # everything
//   node tools/check.mjs --fast   # skip node --test (typecheck + static checks)
//
// Runs, in order:
//   1. tsc --noEmit         (typescript resolved locally if installed, else
//                            pinned via `npx --yes --package typescript@5`)
//   2. tools/check-*.mjs    discovered by glob — a future gate half is a file
//                            drop, zero wiring. A check-* that is NOT a gate
//                            half (needs arguments, e.g. check-vendored.mjs)
//                            opts out with a `// gate: off` line in its header.
//   3. node --test          over the tree's *.test.mjs (skipped under --fast,
//                            or when there are none)
//
// All halves run even after a failure — one pass yields the full defect list —
// then one ✓/✗ summary block; exit non-zero if any half failed. Paths derive
// from this file's own location (tools/ sits in the root it checks), so the
// same file works in vanilla-web, vanilla-components, and any scaffolded app.
// Zero-dep (node:child_process).
import { globSync, readFileSync, existsSync } from "node:fs";
import { scanPaths } from "./js-scan.mjs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const FAST = process.argv.includes("--fast");

/** @type {Array<{name: string, cmd: string, args: string[]}>} */
const halves = [];

// 1. tsc --noEmit — use a locally resolvable typescript install when present
// (an app with the one sanctioned devDependency), else the pinned npx fallback
// that needs no package.json at all.
const tsc = (() => {
  try {
    const lib = createRequire(join(ROOT, "noop.js")).resolve("typescript");
    return { cmd: process.execPath, args: [join(dirname(lib), "..", "bin", "tsc")] };
  } catch {
    // Run npx's SCRIPT under this node, not the `npx` shim, when it sits beside
    // the interpreter (it does in every official install). On Windows the shim
    // is npx.cmd: spawnSync does no PATHEXT lookup, so a bare "npx" is ENOENT,
    // and naming npx.cmd instead earns EINVAL, because node refuses to spawn a
    // .cmd without a shell (CVE-2024-27980). `shell: true` is the usual escape
    // and the worse one here: it hands ROOT below to cmd.exe for a second round
    // of quoting, and ROOT is a path this tool does not get to choose.
    const cli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
    const via = existsSync(cli)
      ? { cmd: process.execPath, args: [cli] }
      : { cmd: "npx", args: /** @type {string[]} */ ([]) };
    return { cmd: via.cmd, args: [...via.args, "--yes", "--package", "typescript@5", "tsc"] };
  }
})();
halves.push({ name: "tsc --noEmit", cmd: tsc.cmd, args: [...tsc.args, "--noEmit", "-p", ROOT] });

// 2. every gate-half checker in tools/ — discovery over configuration.
for (const rel of globSync("tools/check-*.mjs", { cwd: ROOT }).sort()) {
  const head = readFileSync(join(ROOT, rel), "utf8").split("\n", 20);
  if (head.some((l) => /^\/\/\s*gate:\s*off\b/.test(l))) continue; // not a half
  halves.push({ name: basename(rel, ".mjs"), cmd: process.execPath, args: [join(ROOT, rel)] });
}

// 3. the node test files guarding the invariants dynamically (leak tests etc.).
if (!FAST) {
  // scanPaths, not globSync: the skip below is `/`-shaped and globSync answers
  // native separators, so on Windows a raw glob would hand node --test the
  // node_modules/ and testing/ files this filter exists to drop (js-scan.mjs).
  const tests = scanPaths("**/*.test.mjs", ROOT)
    .filter((p) => !/(^|\/)(node_modules|testing)\//.test(p + "/")).sort();
  if (tests.length) {
    halves.push({ name: "node --test", cmd: process.execPath, args: ["--test", ...tests] });
  }
}

/** @type {Array<{name: string, ok: boolean, ms: number}>} */
const results = [];
for (const h of halves) {
  console.log(`\n── ${h.name} ${"─".repeat(Math.max(2, 60 - h.name.length))}`);
  const t0 = Date.now();
  const r = spawnSync(h.cmd, h.args, { cwd: ROOT, stdio: "inherit" });
  if (r.error) console.error(`  failed to run ${h.cmd}: ${r.error.message}`);
  results.push({ name: h.name, ok: r.status === 0, ms: Date.now() - t0 });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n── gate ${"─".repeat(55)}`);
for (const r of results) {
  console.log(` ${r.ok ? "✓" : "✗"} ${r.name.padEnd(22)} ${(r.ms / 1000).toFixed(1)}s`);
}
if (failed.length) {
  console.error(`✗ gate: ${failed.length} of ${results.length} halves failed (${failed.map((f) => f.name).join(", ")})`);
  process.exit(1);
}
console.log(`✓ gate: all ${results.length} halves passed${FAST ? " (--fast: node --test skipped)" : ""}`);
