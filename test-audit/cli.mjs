#!/usr/bin/env node
// test-audit: classify the tests a change adds, per test, against the
// questions a reviewer asks. The CLI reads a change, extracts its tests, asks
// the SystemOne battery once per test, and prints a verdict. It is advisory:
// exit 1 means "a test needs eyes", never "the gate blocked", and exit 2 means
// a usage or transport failure.
//
//   node cli.mjs                     audit the working tree against the default branch
//   node cli.mjs --base main         audit against a named base commit
//   node cli.mjs --staged            audit the staged change
//   node cli.mjs --files a.test.mjs  audit named files
//   node cli.mjs --json              full record
//   node cli.mjs --url http://127.0.0.1:11434 --model nimble   point at any SystemOne endpoint
//   node cli.mjs --selftest          live calibration over the cases in checks/*/cases/
//   node cli.mjs --selftest --targets "http://127.0.0.1:11434|nimble, http://127.0.0.1:11435|winnow:e4b"
//
// A transport failure is an audit failure, not a skip: the affected test
// escalates like any other, and the run exits 2.

import process from "node:process";
import { parseArgs as parseArgv } from "node:util";
import { runAudit } from "./audit.mjs";
import { exitCode, formatAudit } from "./report/index.mjs";
import config from "./config.mjs";

const USAGE = `test-audit: a SystemOne classifier for the tests a change adds

  node cli.mjs [options]

  --base <ref>       diff against the merge base of <ref> and HEAD
  --head <ref>       audit <base>...<ref> instead of the working tree
  --staged           audit the staged change
  --files <path...>  audit named files
  --url <base>       SystemOne base URL (Ollama 0.35+, llama-arbiter, or TypeSafe)
  --model <id>       decision model the base serves
  --json             print the full record
  --markdown         print a review comment
  --selftest         live calibration over the cases in checks/ (needs an endpoint)
  --benchmark        with --selftest, print a markdown benchmark report
  --targets <list>   comma-separated "url|model" or "model" entries to compare
  --models <list>    comma-separated models on the configured URL to compare
  --cases <list>     with --selftest, run only these cases: a case folder name or a test name
  --help             this text

  TEST_AUDIT_SYSTEMONE_URL, TEST_AUDIT_MODEL, TEST_AUDIT_MIN_MASS,
  TEST_AUDIT_STABLE_BAND, TEST_AUDIT_CONCURRENCY, TEST_AUDIT_TIMEOUT_MS,
  TEST_AUDIT_STATE_CAP, TEST_AUDIT_CHANGE_CAP
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  if (args.benchmark && !args.selftest) throw new Error("--benchmark needs --selftest");
  if (args.cases && !args.selftest) throw new Error("--cases needs --selftest");
  if (args.selftest) {
    const { runSelftest } = await import("./calibration/runner.mjs");
    const { text, code } = await runSelftest({
      targets: selftestTargets(args),
      benchmark: args.benchmark,
      cases: args.cases,
      onProgress: (event) => {
        process.stderr.write(`  [${event.target} ${event.index}/${event.total}] ${event.status.padEnd(6)} ${event.test}\n`);
      },
    });
    console.log(text);
    return code;
  }
  const audit = await runAudit(args, { cwd: process.cwd(), url: args.url, model: args.model });
  const format = args.json ? "json" : args.markdown ? "markdown" : "text";
  console.log(formatAudit(audit, { format }));
  return exitCode(audit.results);
}

/**
 * The calibration targets. `--targets` entries are `url|model` or `model`;
 * `--models` is a shorthand for several models on one URL. Neither given means
 * the configured URL and model.
 * @param {ReturnType<typeof parseArgs>} args
 * @returns {Array<{url: string, model: string}>}
 */
function selftestTargets(args) {
  const fallbackUrl = args.url ?? config.baseUrl;
  if (args.targets?.length) {
    return args.targets.map((entry) => {
      const [url, model] = entry.includes("|") ? splitOnce(entry, "|") : [fallbackUrl, entry];
      return { url, model };
    });
  }
  if (args.models?.length) return args.models.map((model) => ({ url: fallbackUrl, model }));
  return [{ url: fallbackUrl, model: args.model ?? config.model }];
}

/** @param {string} text @param {string} sep */
function splitOnce(text, sep) {
  const at = text.indexOf(sep);
  return [text.slice(0, at), text.slice(at + sep.length)];
}

/**
 * `--files` takes the paths that follow it, so the paths arrive as positionals.
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const { values, positionals } = parseArgv({
    args: argv,
    allowPositionals: true,
    options: {
      base: { type: "string" },
      head: { type: "string" },
      staged: { type: "boolean", default: false },
      files: { type: "boolean", default: false },
      url: { type: "string" },
      model: { type: "string" },
      targets: { type: "string" },
      models: { type: "string" },
      cases: { type: "string" },
      json: { type: "boolean", default: false },
      markdown: { type: "boolean", default: false },
      selftest: { type: "boolean", default: false },
      benchmark: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.files && positionals.length === 0) throw new Error("--files needs at least one path");
  if (!values.files && positionals.length) throw new Error(`unknown argument: ${positionals[0]}`);
  return {
    ...values,
    files: values.files ? positionals : undefined,
    targets: values.targets === undefined ? undefined : list(values.targets),
    models: values.models === undefined ? undefined : list(values.models),
    cases: values.cases === undefined ? undefined : list(values.cases),
  };
}

/** @param {string} value */
function list(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// `process.exitCode`, not `process.exit`: a large --json report through a pipe
// would lose its tail if the process exited before stdout drained.
main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.error(`test-audit: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 2;
  },
);
