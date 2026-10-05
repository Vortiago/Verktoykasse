// One audit: read the change, extract its tests, and classify each with one
// SystemOne call. The CLI and the OpenCode plugin both call `runAudit`, so they
// share one pipeline.

import process from "node:process";
import { changeContext, collect, extractTests, isTestFile } from "./change/index.mjs";
import { classify, tokensOf, usageMeter } from "./classifier/index.mjs";
import { mapPool } from "./lib/pool.mjs";
import config from "./config.mjs";

/**
 * @param {{ base?: string, head?: string, staged?: boolean, files?: string[] }} [args]
 * @param {{ config?: object, cwd?: string, ask?: Function, url?: string, model?: string, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ results: any[], ref: string, usage: { calls: number, tokens: number } }>}
 */
export async function runAudit(args = {}, opts = {}) {
  const cfg = opts.config ?? config;
  const cwd = opts.cwd ?? process.cwd();
  const change = collect({ base: args.base, head: args.head, staged: args.staged, files: args.files, cwd });

  const tests = [];
  for (const file of change.files) {
    // A named file is trusted as a test file; a discovered one must look like one.
    if (!args.files && !isTestFile(file.path)) continue;
    for (const test of extractTests(file.text, file.path)) tests.push(test);
  }
  if (tests.length === 0) return { results: [], ref: change.ref, usage: { calls: 0, tokens: 0 } };

  const meter = usageMeter();
  const context = changeContext(change.diff, cfg.changeContextCap);
  const results = await mapPool(tests, cfg.concurrency, (test) =>
    classify(test, {
      ask: opts.ask,
      config: cfg,
      url: opts.url,
      model: opts.model,
      changeContext: context,
      onResponse: meter.onResponse,
      signal: opts.signal,
    }),
  );
  return { results, ref: change.ref, usage: meter.usage };
}