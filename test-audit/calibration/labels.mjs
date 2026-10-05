// The labelled corpus: the baseline in labels.json plus one fragment per defect
// family in labels/. A new family is a file drop.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ACCEPTANCE = { canFailAgreement: 0.9 };

/**
 * @returns {{ acceptance: { canFailAgreement: number }, cases: any[] }}
 */
export function loadLabels() {
  const cases = [];
  let acceptance = DEFAULT_ACCEPTANCE;
  try {
    const baseline = JSON.parse(readFileSync(join(HERE, "labels.json"), "utf8"));
    if (Array.isArray(baseline.cases)) cases.push(...baseline.cases);
    if (baseline.acceptance) acceptance = baseline.acceptance;
  } catch {
    // No baseline yet: the fragments alone are the corpus.
  }
  for (const name of readdirSync(join(HERE, "labels")).sort()) {
    if (!name.endsWith(".json")) continue;
    const fragment = JSON.parse(readFileSync(join(HERE, "labels", name), "utf8"));
    if (Array.isArray(fragment.cases)) cases.push(...fragment.cases);
  }
  return { acceptance, cases };
}
