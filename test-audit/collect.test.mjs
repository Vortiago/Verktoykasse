// Unit test for the one pure helper in the read half. `collect` itself shells
// out to git, so it is exercised by a manual run, not by the repo gate.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNameOnly } from "./collect.mjs";

test("parseNameOnly drops blank lines and trims", () => {
  assert.deepEqual(parseNameOnly("src/a.js\n\n src/b.test.js \n"), ["src/a.js", "src/b.test.js"]);
  assert.deepEqual(parseNameOnly(""), []);
});
