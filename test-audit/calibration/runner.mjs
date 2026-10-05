// The live calibration runner: classify every labelled case against one or more
// endpoints and report agreement. It needs the network, so it is not part of the
// repo gate. `runSelftest` is the interface.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractTests, findSmells, findFileFlags } from "../change/index.mjs";
import { classify, ask as systemoneAsk, tokensOf } from "../classifier/index.mjs";
import { mapPool } from "../lib/pool.mjs";
import { loadLabels } from "./labels.mjs";
import { judge, rowStatus } from "./judge.mjs";
import { formatBenchmark, formatMatrix, formatSingle } from "./format.mjs";
import config from "../config.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * @param {{ config?: object, ask?: Function, targets?: Array<{url: string, model: string, label: string}>, benchmark?: boolean, onProgress?: (event: { target: string, index: number, total: number, status: string, test: string }) => void }} [opts]
 * @returns {Promise<{ text: string, code: number }>}
 */
export async function runSelftest(opts = {}) {
  const cfg = opts.config ?? config;
  const ask = opts.ask ?? systemoneAsk;
  const labels = loadLabels();
  const targets = opts.targets?.length ? opts.targets : [{ url: cfg.baseUrl, model: cfg.model, label: cfg.model }];

  const entries = [];
  for (const target of targets) {
    const usage = { calls: 0, tokens: 0 };
    const onResponse = (json) => {
      usage.calls += 1;
      usage.tokens += tokensOf(json.usage);
    };
    let done = 0;
    const total = labels.cases.length;
    const rows = await mapPool(labels.cases, cfg.concurrency, async (label, index) => {
      const row = await runCase(label, { cfg, ask, target, onResponse });
      done += 1;
      opts.onProgress?.({
        target: target.label,
        index: done,
        total,
        position: index + 1,
        status: rowStatus(row),
        test: label.test,
      });
      return row;
    });
    entries.push({ target, rows, verdict: judge(rows, labels.acceptance), usage });
  }
  const pass = entries.every((entry) => entry.verdict.pass);
  const text = opts.benchmark ? formatBenchmark(entries) : entries.length === 1 ? formatSingle(entries[0]) : formatMatrix(entries);
  return { text, code: pass ? 0 : 1 };
}

/**
 * Classify one labelled case. The test is found by name, so a case file may hold
 * more than one test.
 * @param {any} label
 * @param {{ cfg: object, ask: Function, target: {url: string, model: string}, onResponse: (json: object) => void }} ctx
 */
async function runCase(label, ctx) {
  const text = readFileSync(join(HERE, label.file), "utf8");
  const test = extractTests(text, label.file).find((candidate) => candidate.name === label.test);
  if (!test) return { label, error: `test not found: ${label.test}` };
  const smellFlags = [...findFileFlags(text), ...findSmells(test)];
  const result = await classify(test, {
    ask: ctx.ask,
    config: ctx.cfg,
    url: ctx.target.url,
    model: ctx.target.model,
    smellFlags,
    onResponse: ctx.onResponse,
  });
  return { label, result };
}
