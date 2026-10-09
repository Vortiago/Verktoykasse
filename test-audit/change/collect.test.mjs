// Unit tests for the parts of the read half that need no git: the path-list
// parse, and the named-files branch of `collect`. The git modes shell out to
// git, so a manual run exercises them, not the repo gate.

import { test } from "node:test";
import assert from "node:assert/strict";
import { collect, parseNameOnly } from "./collect.mjs";

test("parseNameOnly splits git's NUL-separated list and keeps each path exact", () => {
  assert.deepEqual(parseNameOnly("src/a.js\0tests/kø.test.js\0tests/a b.test.js\0"), ["src/a.js", "tests/kø.test.js", "tests/a b.test.js"]);
  assert.deepEqual(parseNameOnly(""), []);
});

test("a named file that cannot be read fails the run instead of auditing nothing", () => {
  assert.throws(() => collect({ files: ["no-such-dir/missing.test.mjs"] }), /cannot read no-such-dir\/missing\.test\.mjs/);
});

test("named files refuse a range, and refuse to be empty", () => {
  // Named files replace the git read: a range given with them would be dropped
  // in silence, and an empty list would read as "no files" and audit all.
  assert.throws(() => collect({ files: ["a.test.mjs"], staged: true }), /cannot combine/);
  assert.throws(() => collect({ files: ["a.test.mjs"], base: "main" }), /cannot combine/);
  assert.throws(() => collect({ files: [] }), /at least one path/);
});
