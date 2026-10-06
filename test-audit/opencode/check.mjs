#!/usr/bin/env node
// @ts-check
// check — the gate command for the OpenCode plugin, one thing to run locally
// and in CI, from test-audit/:
//
//   node opencode/check.mjs
//
// Installs the plugin's dependencies into test-audit/node_modules, then runs
// `tsc --noEmit` against opencode/tsconfig.json. Paths derive from this file's
// own location, so the same command works from any directory. test-audit's own
// gate (tools/check.mjs) stays install-free and does not check this directory.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ROOT is test-audit/, where package.json sits; HERE holds the plugin tsconfig.
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const HERE = fileURLToPath(new URL("./", import.meta.url));
const require = createRequire(join(ROOT, "noop.js"));

// A bare `npm` is ENOENT on Windows, and `npm.cmd` cannot be spawned without a
// shell (CVE-2024-27980), so prefer npm's script under this node.
const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const npm = existsSync(npmCli) ? [process.execPath, npmCli] : ["npm"];

// The @opencode/plugin types under test are a dependency, and CI checks out
// clean. Install every run so local and CI resolve the same graph.
const install = spawnSync(npm[0], [...npm.slice(1), "install", "--no-audit", "--no-fund"], {
  cwd: ROOT,
  stdio: "inherit",
});
if (install.error || install.status !== 0) {
  console.error(install.error ? `failed to run npm: ${install.error.message}` : "✗ gate: npm install failed");
  process.exit(1);
}

const tsc = join(dirname(require.resolve("typescript")), "..", "bin", "tsc");
const check = spawnSync(process.execPath, [tsc, "--noEmit", "-p", HERE], { cwd: ROOT, stdio: "inherit" });
if (check.error || check.status !== 0) {
  console.error("✗ gate: tsc --noEmit failed");
  process.exit(1);
}
console.log("✓ gate: tsc --noEmit passed");
