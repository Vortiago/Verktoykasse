// One labelled case as the endpoint sees it: the test that the extractor finds
// in the case file, and the code under test as the change context that a real
// audit sends. The paths are neutral, because the path of a case states its
// label. This module asks no endpoint, so the tests can build the same state.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { changeContext, extractTests } from "../change/index.mjs";
import { ROOT } from "./labels.mjs";
import config from "../config.mjs";

/** The file name the model sees for every case. A case's path states its label
 * (`checks/can-fail/cases/tautology-constant/`), so sending it would leak the
 * answer. */
export const NEUTRAL_TEST_PATH = "example.test.mjs";
/** The neutral path the code under test sits at in the change context. */
const NEUTRAL_CODE_PATH = "src/example.mjs";

/** @typedef {import("../types.d.ts").CalibrationLabel} CalibrationLabel */
/** @typedef {import("../types.d.ts").CalibrationRow} CalibrationRow */
/** One labelled case, read and parsed, before a run asks about it. @typedef {Omit<CalibrationRow, "result">} PreparedCase */

/**
 * Read and parse one labelled case. The test is found by name, so a case file
 * may hold more than one test. The change context goes through the same cap as
 * in a real audit.
 * @param {CalibrationLabel} label
 * @returns {PreparedCase}
 */
export function prepareCase(label) {
  try {
    const text = readFileSync(join(ROOT, label.file), "utf8");
    const test = extractTests(text, NEUTRAL_TEST_PATH).find((candidate) => candidate.name === label.test);
    const code = label.code ? readFileSync(join(ROOT, label.code), "utf8") : undefined;
    const context = code === undefined ? "" : changeContext(codeContext(code), config.changeContextCap);
    return { label, test, code, context };
  } catch (err) {
    return { label, error: `cannot read ${label.file}: ${err instanceof Error ? err.message : err}` };
  }
}

/**
 * The code under test as the diff a real audit reads: a new file at a neutral
 * path.
 * @param {string} code
 */
export function codeContext(code) {
  const lines = code.replace(/\n$/, "").split("\n");
  return [`diff --git a/${NEUTRAL_CODE_PATH} b/${NEUTRAL_CODE_PATH}`, "new file mode 100644", "--- /dev/null", `+++ b/${NEUTRAL_CODE_PATH}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
}
