// The live calibration runner: classify every labelled case against one or more
// endpoints and report agreement. It needs the network, so it is not part of the
// repo gate. `runSelftest` is the interface.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractTests } from "../change/index.mjs";
import { classify, usageMeter } from "../classifier/index.mjs";
import { mapPool } from "../lib/pool.mjs";
import { loadLabels } from "./labels.mjs";
import { judge, rowStatus } from "./judge.mjs";
import { formatBenchmark, formatMatrix, formatSingle } from "./format.mjs";
import config from "../config.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * @param {{ config?: object, targets?: Array<{url: string, model: string, label: string}>, benchmark?: boolean, onProgress?: (event: { target: string, index: number, total: number, status: string, test: string }) => void }} [opts]
 * @returns {Promise<{ text: string, code: number }>}
 */
export async function runSelftest(opts = {}) {
  const cfg = opts.config ?? config;
  const labels = loadLabels();
  // Read and parse every case once; every target reuses it.
  const cases = labels.cases.map(prepareCase);
  const targets = opts.targets?.length ? opts.targets : [{ url: cfg.baseUrl, model: cfg.model, label: cfg.model }];

  const entries = [];
  for (const target of targets) {
    const meter = usageMeter();
    let done = 0;
    const total = cases.length;
    const rows = await mapPool(cases, cfg.concurrency, async (item) => {
      const row = await runCase(item, { cfg, target, onResponse: meter.onResponse });
      done += 1;
      opts.onProgress?.({ target: target.label, index: done, total, status: rowStatus(row), test: item.label.test });
      return row;
    });
    entries.push({ target, rows, verdict: judge(rows, labels.acceptance), usage: meter.usage });
  }
  const pass = entries.every((entry) => entry.verdict.pass);
  const text = opts.benchmark ? formatBenchmark(entries) : entries.length === 1 ? formatSingle(entries[0]) : formatMatrix(entries);
  return { text, code: pass ? 0 : 1 };
}

/**
 * Read and parse one labelled case. The test is found by name, so a case file
 * may hold more than one test.
 * @param {any} label
 * @returns {{ label: any, test?: object, error?: string }}
 */
function prepareCase(label) {
  try {
    const text = readFileSync(join(HERE, label.file), "utf8");
    const test = extractTests(text, label.file).find((candidate) => candidate.name === label.test);
    return { label, test };
  } catch (err) {
    return { label, error: `cannot read ${label.file}: ${err instanceof Error ? err.message : err}` };
  }
}

/**
 * Classify one prepared case.
 * @param {{ label: any, test?: object, error?: string }} item
 * @param {{ cfg: object, target: {url: string, model: string}, onResponse: (json: object) => void }} ctx
 */
async function runCase(item, ctx) {
  if (!item.test) return { label: item.label, error: item.error ?? `test not found: ${item.label.test}` };
  const result = await classify(item.test, {
    config: ctx.cfg,
    url: ctx.target.url,
    model: ctx.target.model,
    onResponse: ctx.onResponse,
  });
  return { label: item.label, result };
}