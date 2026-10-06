// The labelled corpus: every calibration case in the check slices. A case is one
// folder, checks/<check>/cases/<case>/. It holds the test in `case.mjs`, the
// label in `label.json`, and, when the right answer depends on it, the code
// under test in `code.mjs`. A `label.json` holds a list of labels when the case
// file holds more than one labelled test. A new case is a folder drop.
//
// The sources of a case live once, in the header comment of its `case.mjs`.
// The loader reads them from there, so the benchmark can print them.

import { existsSync, globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/** test-audit/: the label paths are relative to it, so the benchmark links resolve. */
export const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The file in a case folder that holds the test. */
export const CASE_FILE = "case.mjs";
/** The file in a case folder that holds the label, or a list of labels. */
export const LABEL_FILE = "label.json";
/** The file in a case folder that holds the code under test, if the case has one. */
export const CODE_FILE = "code.mjs";

/** The fields a `label.json` may hold. A field that names a question of the battery, such as `deterministic`, is an expected answer. */
export const LABEL_FIELDS = ["test", "defect", "canFail", "mustEscalate", "mixed", "deterministic", "note"];
/** The fields the loader adds from the case folder. */
export const LOADED_FIELDS = ["check", "file", "code", "sources"];

/** @typedef {import("../types.d.ts").CalibrationLabel} CalibrationLabel */
/** @typedef {import("../types.d.ts").Source} Source */

/**
 * Every label, with the check, the case file, the code file and the sources
 * that its folder gives it. The order is by check, then by case.
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
    const file = `${folder}/${CASE_FILE}`;
    const where = { check: folder.split("/")[1], file, sources: sourcesOf(readFileSync(join(ROOT, file), "utf8")) };
    const code = existsSync(join(ROOT, folder, CODE_FILE)) ? { code: `${folder}/${CODE_FILE}` } : {};
    for (const label of Array.isArray(parsed) ? parsed : [parsed]) labels.push({ ...label, ...where, ...code });
  }
  return labels;
}

/**
 * The comment at the head of a file: the `//` lines before the first line of
 * code, without their markers.
 * @param {string} text
 * @returns {string[]}
 */
export function headerOf(text) {
  const lines = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("//")) break;
    lines.push(line.slice(2));
  }
  return lines;
}

/**
 * The sources a header comment names. A case names each one on a
 * `Source: <name>.` line; a check lists them under `Sources:`, one `- <name>`
 * for each. An indented line with a URL gives the URL of the source above it,
 * and an indented line before the URL continues its name. A source with no URL
 * takes the indented lines under it into its name.
 * @param {string} text the file
 * @returns {Source[]}
 */
export function sourcesOf(text) {
  /** @type {Source[]} */
  const sources = [];
  let list = false;
  /** @type {Source | undefined} */
  let current;
  for (const line of headerOf(text)) {
    const single = line.match(/^ Source: (.+)$/);
    const item = list ? line.match(/^ - (.+)$/) : null;
    if (single || item) {
      current = { name: (single ?? item)?.[1].trim() ?? "" };
      sources.push(current);
    } else if (/^ Sources:\s*$/.test(line)) {
      list = true;
      current = undefined;
    } else if (current && /^\s{2,}\S/.test(line)) {
      const url = line.trim().match(/^https?:\/\/\S+$/);
      if (url && !current.url) current.url = url[0];
      else if (!current.url) current.name += ` ${line.trim()}`;
    } else {
      list = false;
      current = undefined;
    }
  }
  return sources.map((source) => ({ ...source, name: source.name.replace(/\.$/, "") }));
}
