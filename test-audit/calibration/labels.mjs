// The labelled corpus: the acceptance bar in labels.json plus one fragment per
// defect family in labels/. A new family is a file drop.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

/** @typedef {import("../types.d.ts").CalibrationLabel} CalibrationLabel */

/**
 * @returns {{ acceptance: { canFailAgreement: number }, cases: CalibrationLabel[] }}
 */
export function loadLabels() {
  const { acceptance } = JSON.parse(readFileSync(join(HERE, "labels.json"), "utf8"));
  /** @type {CalibrationLabel[]} */
  const cases = [];
  for (const name of readdirSync(join(HERE, "labels")).sort()) {
    if (!name.endsWith(".json")) continue;
    let fragment;
    try {
      fragment = JSON.parse(readFileSync(join(HERE, "labels", name), "utf8"));
    } catch (err) {
      throw new Error(`label fragment ${name} is not valid JSON: ${err instanceof Error ? err.message : err}`);
    }
    if (Array.isArray(fragment.cases)) cases.push(...fragment.cases);
  }
  return { acceptance, cases };
}
