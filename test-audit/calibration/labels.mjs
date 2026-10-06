// The labelled corpus: every calibration case in the check slices. A case is one
// folder, checks/<check>/cases/<case>/. It holds the test in `case.mjs`, the
// label in `label.json`, and, when the right answer depends on it, the code
// under test in `code.mjs`. A `label.json` holds a list of labels when the case
// file holds more than one labelled test. A new case is a folder drop.

import { existsSync, globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/** test-audit/: the label paths are relative to it, so the benchmark links resolve. */
const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The file in a case folder that holds the test. */
export const CASE_FILE = "case.mjs";
/** The file in a case folder that holds the label, or a list of labels. */
export const LABEL_FILE = "label.json";
/** The file in a case folder that holds the code under test, if the case has one. */
export const CODE_FILE = "code.mjs";

/** @typedef {import("../types.d.ts").CalibrationLabel} CalibrationLabel */

/**
 * Every label, with the check, the case file and the code file that its folder
 * gives it. The order is by check, then by case.
 * @returns {CalibrationLabel[]}
 */
export function loadLabels() {
  /** @type {CalibrationLabel[]} */
  const labels = [];
  const paths = globSync(`checks/*/cases/*/${LABEL_FILE}`, { cwd: ROOT }).map((path) => path.replaceAll("\\", "/"));
  for (const path of paths.sort()) {
    const folder = path.slice(0, -LABEL_FILE.length - 1);
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(ROOT, path), "utf8"));
    } catch (err) {
      throw new Error(`${path} is not valid JSON: ${err instanceof Error ? err.message : err}`);
    }
    const where = { check: folder.split("/")[1], file: `${folder}/${CASE_FILE}` };
    const code = existsSync(join(ROOT, folder, CODE_FILE)) ? { code: `${folder}/${CODE_FILE}` } : {};
    for (const label of Array.isArray(parsed) ? parsed : [parsed]) labels.push({ ...label, ...where, ...code });
  }
  return labels;
}
