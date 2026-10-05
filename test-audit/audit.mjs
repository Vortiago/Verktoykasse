// One audit: read the change, extract its tests, smell each one statically, and
// classify each with one SystemOne call. The CLI and the OpenCode plugin both
// call `runAudit`, so they share one pipeline.

import process from "node:process";
import { collect, extractTests, isTestFile, splitDiff, findSmells, findFileFlags } from "./change/index.mjs";
import { classify, tokensOf } from "./classifier/index.mjs";
import { mapPool } from "./lib/pool.mjs";
import config from "./config.mjs";

/**
 * @param {{ base?: string, head?: string, staged?: boolean, files?: string[] }} [args]
 * @param {{ config?: object, cwd?: string, ask?: Function, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ results: any[], ref: string, usage: { calls: number, tokens: number }, files: string[] }>}
 */
export async function runAudit(args = {}, opts = {}) {
  const cfg = opts.config ?? config;
  const cwd = opts.cwd ?? process.cwd();
  const change = collect({ base: args.base, head: args.head, staged: args.staged, files: args.files, cwd });

  const tests = [];
  const fileText = new Map();
  const audited = [];
  for (const file of change.files) {
    // A named file is trusted as a test file; a discovered one must look like one.
    if (!args.files && !isTestFile(file.path)) continue;
    fileText.set(file.path, file.text);
    const found = extractTests(file.text, file.path);
    if (found.length) audited.push(file.path);
    for (const test of found) tests.push(test);
  }

  const context = changeContext(change.diff, cfg.changeContextCap);
  const usage = { calls: 0, tokens: 0 };
  const onResponse = (json) => {
    usage.calls += 1;
    usage.tokens += tokensOf(json.usage);
  };

  const results = await mapPool(tests, cfg.concurrency, (test) => {
    const smellFlags = [...findFileFlags(fileText.get(test.file) ?? ""), ...findSmells(test)];
    return classify(test, {
      ask: opts.ask,
      config: cfg,
      url: opts.url,
      model: opts.model,
      changeContext: context,
      smellFlags,
      onResponse,
      signal: opts.signal,
    });
  });
  return { results, ref: change.ref, usage, files: audited };
}

/**
 * The diff with its test-file sections removed: the reviewer's questions are
 * about the test, so the non-test part is the useful context.
 * @param {string} diff
 * @param {number} cap
 */
export function changeContext(diff, cap) {
  const text = splitDiff(diff)
    .filter((section) => !isTestFile(section.path))
    .map((section) => section.text)
    .join("\n");
  return text.length > cap ? `${text.slice(0, cap)}\n… [context truncated]` : text;
}

