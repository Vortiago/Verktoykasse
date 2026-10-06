// The live calibration runner: classify every labelled case against one or more
// endpoints and report agreement. It needs the network, so it is not part of the
// repo gate. `runSelftest` is the interface; the CLI imports it from here.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { extractTests } from "../change/index.mjs";
import { classify, usageMeter } from "../classifier/index.mjs";
import { mapPool } from "../lib/pool.mjs";
import { loadLabels } from "./labels.mjs";
import { judge, rowStatus } from "./judge.mjs";
import { formatBenchmark, formatMatrix, formatSingle } from "./format.mjs";
import config from "../config.mjs";

/** test-audit/: the label paths are relative to it. */
const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The file name the model sees for every case. A case's path states its label
 * (`checks/can-fail/cases/tautology-constant/`), so sending it would leak the
 * answer. */
const NEUTRAL_TEST_PATH = "example.test.mjs";
/** The neutral path the code under test sits at in the change context. */
const NEUTRAL_CODE_PATH = "src/example.mjs";

/** @typedef {import("../types.d.ts").AuditTest} AuditTest */
/** @typedef {import("../types.d.ts").CalibrationLabel} CalibrationLabel */
/** @typedef {import("../types.d.ts").CalibrationRow} CalibrationRow */
/** @typedef {{ label: CalibrationLabel, test?: AuditTest, code?: string, error?: string }} PreparedCase */

/**
 * @param {{ targets: Array<{url: string, model: string}>, benchmark?: boolean, onProgress?: (event: { target: string, index: number, total: number, status: string, test: string }) => void }} opts
 * @returns {Promise<{ text: string, code: number }>}
 */
export async function runSelftest(opts) {
  // Read and parse every case once; every target reuses it.
  const cases = loadLabels().map(prepareCase);

  /** @param {{ url: string, model: string }} target */
  const runTarget = async (target) => {
    const meter = usageMeter();
    let done = 0;
    const total = cases.length;
    const rows = await mapPool(cases, config.concurrency, async (item) => {
      const row = await runCase(item, { target, onResponse: meter.onResponse });
      done += 1;
      opts.onProgress?.({ target: target.model, index: done, total, status: rowStatus(row), test: item.label.test });
      return row;
    });
    return { target, rows, verdict: judge(rows), usage: meter.usage };
  };

  // One lane per URL. The targets on one URL (`--models`) share its endpoint,
  // so they run one after another; distinct URLs run side by side. Either way an
  // endpoint takes at most `concurrency` calls at a time.
  /** @type {Map<string, number[]>} */
  const lanes = new Map();
  opts.targets.forEach((target, index) => lanes.set(target.url, [...(lanes.get(target.url) ?? []), index]));
  /** @type {Array<Awaited<ReturnType<typeof runTarget>>>} */
  const entries = new Array(opts.targets.length);
  await Promise.all(
    [...lanes.values()].map(async (indices) => {
      for (const index of indices) entries[index] = await runTarget(opts.targets[index]);
    }),
  );
  const pass = entries.every((entry) => entry.verdict.pass);
  const date = `Date: ${new Date().toISOString().slice(0, 10)}.`;
  const text = opts.benchmark ? formatBenchmark(entries, { preamble: [date] }) : entries.length === 1 ? formatSingle(entries[0]) : formatMatrix(entries);
  return { text, code: pass ? 0 : 1 };
}

/**
 * Read and parse one labelled case. The test is found by name, so a case file
 * may hold more than one test.
 * @param {CalibrationLabel} label
 * @returns {PreparedCase}
 */
function prepareCase(label) {
  try {
    const text = readFileSync(join(ROOT, label.file), "utf8");
    const test = extractTests(text, NEUTRAL_TEST_PATH).find((candidate) => candidate.name === label.test);
    const code = label.code ? readFileSync(join(ROOT, label.code), "utf8") : undefined;
    return { label, test, code };
  } catch (err) {
    return { label, error: `cannot read ${label.file}: ${err instanceof Error ? err.message : err}` };
  }
}

/**
 * The code under test as the change context a real audit sends: the non-test
 * part of a diff. The path is neutral, because a case file's name states its
 * label.
 * @param {string} code
 */
export function codeContext(code) {
  const lines = code.replace(/\n$/, "").split("\n");
  return [`diff --git a/${NEUTRAL_CODE_PATH} b/${NEUTRAL_CODE_PATH}`, "new file mode 100644", "--- /dev/null", `+++ b/${NEUTRAL_CODE_PATH}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
}

/**
 * Classify one prepared case.
 * @param {PreparedCase} item
 * @param {{ target: {url: string, model: string}, onResponse: (json: object) => void }} ctx
 * @returns {Promise<CalibrationRow>}
 */
async function runCase(item, ctx) {
  if (!item.test) return { label: item.label, error: item.error ?? `test not found: ${item.label.test}` };
  const result = await classify(item.test, {
    url: ctx.target.url,
    model: ctx.target.model,
    changeContext: item.code ? codeContext(item.code) : "",
    onResponse: ctx.onResponse,
  });
  return { label: item.label, test: item.test, code: item.code, result };
}