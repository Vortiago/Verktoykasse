// One audit: read the change, extract its tests, and classify each with one
// SystemOne call. The CLI and the OpenCode plugin both call `runAudit`, so they
// share one pipeline.

import process from "node:process";
import { changeContext, collect, extractTests, isTestFile } from "./change/index.mjs";
import { classify, usageMeter } from "./classifier/index.mjs";
import { mapPool } from "./lib/pool.mjs";
import config from "./config.mjs";

/** @typedef {import("./types.d.ts").AuditResult} AuditResult */
/** @typedef {import("./types.d.ts").AuditUsage} AuditUsage */

/**
 * @param {{ base?: string, head?: string, staged?: boolean, files?: string[] }} [args]
 * @param {{ cwd?: string, url?: string, model?: string }} [opts]
 * @returns {Promise<{ results: AuditResult[], ref: string, model: string, usage: AuditUsage }>}
 */
export async function runAudit(args = {}, opts = {}) {
  const url = opts.url ?? config.baseUrl;
  const model = opts.model ?? config.model;
  // A named file is trusted as a test file (collect reads it unfiltered); a
  // discovered one must look like one. The filter runs before the read, so
  // only test files are read.
  const change = collect({
    base: args.base,
    head: args.head,
    staged: args.staged,
    files: args.files,
    cwd: opts.cwd ?? process.cwd(),
    filter: isTestFile,
  });

  const tests = change.files.flatMap((file) => extractTests(file.text, file.path));
  if (tests.length === 0) return { results: [], ref: change.ref, model, usage: { calls: 0, tokens: 0 } };

  const meter = usageMeter();
  const context = changeContext(change.readDiff(), config.changeContextCap);
  const results = await mapPool(tests, config.concurrency, (test) =>
    classify(test, { url, model, changeContext: context, onResponse: meter.onResponse }),
  );
  return { results, ref: change.ref, model, usage: meter.usage };
}