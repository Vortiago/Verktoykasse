// canonical source: test-audit/audit.mjs@4ba9d42 sha256:f94468e385f7cb8af06877b110743293cc6e4e68b98db9b9f2e090d6a0953327 - vendored copy, do not edit here
// One audit: read the change, extract its tests, and classify each with one
// SystemOne call. The CLI and the OpenCode plugin both call `runAudit`, so they
// share one pipeline.

import process from "node:process";
import { changeContext, changedTests, collect, extractTests, isTestFile } from "./change/index.mjs";
import { classify, usageMeter, verdictFrom } from "./classifier/index.mjs";
import { mapPool } from "./lib/pool.mjs";
import config from "./config.mjs";

/** A file named as a test file: `.test.` or `.spec.`, not only under `__tests__/`. */
const TEST_NAME = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

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

  const extracted = change.files.map((file) => ({ path: file.path, tests: extractTests(file.text, file.path) }));
  const found = extracted.flatMap((entry) => entry.tests);
  // A test file the change touched that yields no test holds a form the
  // extractor cannot read (a tagged-template table, say). It escalates rather
  // than vanish, so a miss is never a clean pass.
  const unread = extracted
    .filter((entry) => entry.tests.length === 0 && (args.files?.length || TEST_NAME.test(entry.path)))
    .map((entry) => unreadResult(entry.path));
  // The diff names the lines the change touched, so an untouched test in a
  // modified file stays out; its non-test part is the context. A change with no
  // test never reads it.
  const diff = found.length ? change.readDiff() : "";
  const tests = changedTests(found, diff);
  if (tests.length === 0) return { results: unread, ref: change.ref, model, usage: { calls: 0, tokens: 0 } };

  const meter = usageMeter();
  const context = changeContext(diff, config.changeContextCap);
  const results = await mapPool(tests, config.concurrency, (test) =>
    classify(test, { url, model, changeContext: context, onResponse: meter.onResponse }),
  );
  return { results: [...unread, ...results], ref: change.ref, model, usage: meter.usage };
}

/**
 * The escalated result for a test file that yields no test. It has no answers,
 * so every check is unanswered; the one reason is the file's.
 * @param {string} file
 * @returns {AuditResult}
 */
function unreadResult(file) {
  const stub = { file, line: 1, name: "(no test found)", path: [], scope: [], source: "", fixtures: [], imports: [], flags: ["no-test-found"] };
  return { ...verdictFrom(stub, {}), needsEyes: true, reasons: ["no test found: the file's tests use a form the extractor cannot read"] };
}
