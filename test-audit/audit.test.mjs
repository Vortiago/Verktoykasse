// Unit test for the audit pipeline's guard against a silent miss: a file with no
// test the extractor can read escalates, and makes no endpoint call. types.d.ts
// stands in for such a file, since it holds no test call.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runAudit } from "./audit.mjs";

test("a named file with no readable test escalates instead of passing clean", async () => {
  const cwd = dirname(fileURLToPath(import.meta.url));
  const audit = await runAudit({ files: ["types.d.ts"] }, { cwd, url: "http://127.0.0.1:9" });
  assert.equal(audit.results.length, 1);
  assert.equal(audit.results[0].needsEyes, true);
  assert.match(audit.results[0].reasons.join(" "), /no test found/);
  assert.equal(audit.usage.calls, 0);
});
