#!/usr/bin/env node
// test-audit: classify the tests a change adds, per test, against the
// questions a reviewer asks. The CLI reads a change, extracts its tests, asks
// the SystemOne battery once per test, and prints a verdict. It is advisory:
// exit 1 means "a test needs eyes", never "the gate blocked".
//
//   node cli.mjs                     audit the working tree against the default branch
//   node cli.mjs --base main         audit against a named base commit
//   node cli.mjs --staged            audit the staged change
//   node cli.mjs --files a.test.mjs  audit named files
//   node cli.mjs --json              full record
//   node cli.mjs --url http://127.0.0.1:11434 --model nimble   point at any SystemOne endpoint
//   node cli.mjs --selftest          live calibration over corpus/
//   node cli.mjs --selftest --targets "http://127.0.0.1:11434|nimble, http://127.0.0.1:11435|winnow:e4b"
//
// A transport failure is an audit failure, not a skip: the affected test
// escalates like any other.

import process from "node:process";
import { runAudit } from "./audit.mjs";
import { exitCode, formatJson, formatMarkdown, formatText } from "./report.mjs";
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
  --selftest         live calibration over corpus/ (needs an endpoint)
  --benchmark        with --selftest, print a markdown benchmark report
  --targets <list>   comma-separated "url|model" or "model" entries to compare
  --models <list>    comma-separated models on the configured URL to compare
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
  if (args.selftest) {
    const { runSelftest } = await import("./corpus.mjs");
    const { text, code } = await runSelftest({
      config,
      targets: selftestTargets(args),
      benchmark: args.benchmark,
      onProgress: (event) => {
        process.stderr.write(`  [${event.target} ${event.index}/${event.total}] ${event.status.padEnd(6)} ${event.test}\n`);
      },
    });
    console.log(text);
    return code;
  }
  const results = await runAudit(args, { cwd: process.cwd(), url: args.url, model: args.model });
  const meta = { ref: results.ref, model: args.model ?? config.model, usage: results.usage };
  if (args.json) console.log(formatJson(results.results, meta));
  else if (args.markdown) console.log(formatMarkdown(results.results, meta));
  else console.log(formatText(results.results, meta));
  return exitCode(results.results);
}

/**
 * The calibration targets. `--targets` entries are `url|model` or `model`;
 * `--models` is a shorthand for several models on one URL. Neither given means
 * the configured URL and model.
 * @param {ReturnType<typeof parseArgs>} args
 * @returns {Array<{url: string, model: string, label: string}> | undefined}
 */
function selftestTargets(args) {
  const fallbackUrl = args.url ?? config.baseUrl;
  if (args.targets?.length) {
    return args.targets.map((entry) => {
      const [url, model] = entry.includes("|") ? splitOnce(entry, "|") : [fallbackUrl, entry];
      return { url, model, label: model };
    });
  }
  if (args.models?.length) {
    return args.models.map((model) => ({ url: fallbackUrl, model, label: model }));
  }
  return undefined;
}

/** @param {string} text @param {string} sep */
function splitOnce(text, sep) {
  const at = text.indexOf(sep);
  return [text.slice(0, at), text.slice(at + sep.length)];
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const args = { base: undefined, head: undefined, staged: false, files: undefined, url: undefined, model: undefined, targets: undefined, models: undefined, json: false, markdown: false, selftest: false, benchmark: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base") args.base = argv[++i];
    else if (arg === "--head") args.head = argv[++i];
    else if (arg === "--staged") args.staged = true;
    else if (arg === "--url") args.url = argv[++i];
    else if (arg === "--model") args.model = argv[++i];
    else if (arg === "--targets") args.targets = list(argv[++i]);
    else if (arg === "--models") args.models = list(argv[++i]);
    else if (arg === "--json") args.json = true;
    else if (arg === "--markdown") args.markdown = true;
    else if (arg === "--selftest") args.selftest = true;
    else if (arg === "--benchmark") args.benchmark = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--files") {
      args.files = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) args.files.push(argv[++i]);
      if (args.files.length === 0) throw new Error("--files needs at least one path");
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

/** @param {string | undefined} value */
function list(value) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`test-audit: ${err instanceof Error ? err.message : err}`);
    process.exit(2);
  },
);
