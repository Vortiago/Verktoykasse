// The live calibration runner: classify every labelled case against one or more
// endpoints and report agreement. It needs the network, so it is not part of the
// repo gate. `runSelftest` is the interface; the CLI imports it from here.

import { classify, usageMeter } from "../classifier/index.mjs";
import { mapPool } from "../lib/pool.mjs";
import { loadLabels, selectLabels } from "./labels.mjs";
import { prepareCase } from "./case-state.mjs";
import { judge, rowStatus } from "./judge.mjs";
import { formatBenchmark, formatMatrix, formatSingle } from "./format.mjs";
import { appendFileSync } from "node:fs";
import config from "../config.mjs";

/** @typedef {import("../types.d.ts").CalibrationRow} CalibrationRow */
/** @typedef {import("./case-state.mjs").PreparedCase} PreparedCase */

/**
 * @param {{ targets: Array<{url: string, model: string}>, benchmark?: boolean, cases?: string[], onProgress?: (event: { target: string, index: number, total: number, status: string, test: string }) => void }} opts
 * @returns {Promise<{ text: string, code: number }>}
 */
export async function runSelftest(opts) {
  // Read and parse every case, and build its change context, once; every target reuses it.
  const cases = selectLabels(loadLabels(), opts.cases).map(prepareCase);

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
 * Classify one prepared case.
 * @param {PreparedCase} item
 * @param {{ target: {url: string, model: string}, onResponse: (json: object) => void }} ctx
 * @returns {Promise<CalibrationRow>}
 */
async function runCase(item, ctx) {
  if (!item.test) return { ...item, error: item.error ?? `test not found: ${item.label.test}` };
  const result = await classify(item.test, {
    url: ctx.target.url,
    model: ctx.target.model,
    changeContext: item.context,
    onResponse: (json) => {
      ctx.onResponse(json);
      // The full reply of each call, one JSON line, when TEST_AUDIT_RAW_LOG names
      // a file: the raw material to recalibrate on, or to split a run by backend.
      if (config.rawLog) appendFileSync(config.rawLog, `${JSON.stringify({ model: ctx.target.model, test: item.label.test, file: item.label.file, reply: json })}\n`);
    },
  });
  return { ...item, result };
}
