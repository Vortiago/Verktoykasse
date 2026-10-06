// Unit test for the audit pipeline's guard against a silent miss: a file with no
// test the extractor can read escalates, and makes no endpoint call. types.d.ts
// stands in for such a file, since it holds no test call.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runAudit } from "./audit.mjs";
import { CHECKS } from "./checks/index.mjs";

test("a named file with no readable test escalates instead of passing clean", async () => {
  const cwd = dirname(fileURLToPath(import.meta.url));
  const audit = await runAudit({ files: ["types.d.ts"] }, { cwd, url: "http://127.0.0.1:9" });
  assert.equal(audit.results.length, 1);
  assert.equal(audit.results[0].needsEyes, true);
  assert.deepEqual(audit.results[0].reasons, ["no test found: the file's tests use a form the extractor cannot read"]);
  assert.deepEqual(audit.results[0].flags, ["no-test-found"]);
  assert.deepEqual(Object.keys(audit.results[0].checks), CHECKS.map((check) => check.name));
  assert.equal(audit.usage.calls, 0);
});
