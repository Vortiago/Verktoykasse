#!/usr/bin/env node
// canonical source: vanilla-web/tools/check-syntax.mjs@bd231d2 sha256:de5f3ac19af32ae185b907c7f18617eee8a3d384352788ec945b47d31dd126e8 - vendored copy, do not edit here
// @ts-check
// check-syntax — `node --check` over every .js and .mjs. tsc covers the same
// files but excludes *.test.mjs, and a file that does not parse is a failure no
// annotation can express: a dropped `//` once turned prose into code in
// serve.mjs and reached CI as a web server that would not start.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ROOT, SKIP, scanPaths } from "./js-scan.mjs";

const files = ["**/*.js", "**/*.mjs"]
  .flatMap((p) => scanPaths(p))
  .filter((p) => !SKIP.test(p + "/"))
  .sort();

/** @type {Array<{where: string, detail: string}>} */
const broken = [];
for (const rel of files) {
  // --check parses without executing, so a module with side effects is safe.
  // Its stderr opens with `<path>:<line>` and carries the SyntaxError further down.
  const r = spawnSync(process.execPath, ["--check", fileURLToPath(new URL(rel, ROOT))], { encoding: "utf8" });
  if (r.status === 0) continue;
  const err = (r.stderr || "").split("\n");
  const line = err[0]?.match(/:(\d+)$/)?.[1];
  const detail = err.find((l) => /^[A-Z]\w*Error\b/.test(l.trim()))?.trim();
  broken.push({
    where: line ? `${rel}:${line}` : rel,
    detail: detail || `node --check exited ${r.status}`,
  });
}

if (broken.length) {
  console.error(`✖ ${broken.length} file${broken.length === 1 ? "" : "s"} failed to parse:`);
  for (const b of broken) console.error(`  ${b.where}  ${b.detail}`);
  process.exit(1);
}
console.log(`✓ check-syntax: all ${files.length} .js/.mjs files parse`);
