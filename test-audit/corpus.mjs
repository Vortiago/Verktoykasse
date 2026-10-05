// The live calibration layer: run the labelled corpus against one or more
// SystemOne endpoints and report agreement. It is not part of the repo gate,
// because it needs the network, and it is the evidence that a decision model is
// trustworthy enough to wire a hook. Run it with `node cli.mjs --selftest`,
// optionally with `--targets` to compare models and endpoints side by side.
//
// The rules under test live in `judge`, which is pure, so the calibration
// scoring is itself unit-tested without a model.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractTests } from "./extract.mjs";
import { findSmells, findFileFlags } from "./smells.mjs";
import { classify } from "./gates.mjs";
import { ask as systemoneAsk, tokensOf } from "./systemone.mjs";
import { mapPool } from "./pool.mjs";
import { canFailText, pad } from "./report.mjs";
import config from "./config.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, "corpus");
const DEFAULT_ACCEPTANCE = { canFailAgreement: 0.9 };

/**
 * Every labelled case. The baseline lives in corpus/labels.json; each defect
 * group adds a fragment in corpus/labels/, so a new group is a file drop.
 * @returns {{ acceptance: { canFailAgreement: number }, cases: any[] }}
 */
export function loadLabels() {
  const cases = [];
  let acceptance = DEFAULT_ACCEPTANCE;
  try {
    const baseline = JSON.parse(readFileSync(join(CORPUS, "labels.json"), "utf8"));
    if (Array.isArray(baseline.cases)) cases.push(...baseline.cases);
    if (baseline.acceptance) acceptance = baseline.acceptance;
  } catch {
    // No baseline yet: the fragments alone are the corpus.
  }
  for (const name of readdirSync(join(CORPUS, "labels")).sort()) {
    if (!name.endsWith(".json")) continue;
    const fragment = JSON.parse(readFileSync(join(CORPUS, "labels", name), "utf8"));
    if (Array.isArray(fragment.cases)) cases.push(...fragment.cases);
  }
  return { acceptance, cases };
}

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
 * Classify one labelled case. The test is found by name, so a case file may
 * hold more than one test.
 * @param {any} label
 * @param {{ cfg: object, ask: Function, target: {url: string, model: string}, onResponse: (json: object) => void }} ctx
 */
async function runCase(label, ctx) {
  const text = readFileSync(join(CORPUS, label.file), "utf8");
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

/**
 * The calibration rules. Only two things are hard: no labelled defect case
 * passes silently, and the mixed cases route to eyes. Agreement is measured
 * only where the tool committed to a can-fail value; an unstable case routed to
 * a human is the design working, not a wrong answer.
 * @param {any[]} rows
 * @param {{ canFailAgreement: number }} acceptance
 */
export function judge(rows, acceptance) {
  let resolved = 0;
  let correct = 0;
  let silentPasses = 0;
  let mixedRouted = 0;
  let mixedTotal = 0;
  let falsePositives = 0;
  let goodTotal = 0;
  let deterministicCorrect = 0;
  let deterministicTotal = 0;
  /** @type {Record<string, { total: number, escalated: number }>} */
  const defects = {};
  for (const row of rows) {
    const { label, result } = row;
    const escalated = !!result && result.needsEyes;
    if (label.mustEscalate) {
      const group = defects[label.defect ?? "other"] ?? { total: 0, escalated: 0 };
      group.total += 1;
      if (escalated) group.escalated += 1;
      defects[label.defect ?? "other"] = group;
      if (!escalated) silentPasses += 1;
    }
    if (!result) continue;
    if (label.mixed) {
      mixedTotal += 1;
      if (result.needsEyes) mixedRouted += 1;
    }
    if (label.mustEscalate === false) {
      goodTotal += 1;
      if (result.needsEyes) falsePositives += 1;
    }
    if (label.deterministic !== undefined && result.descriptive.deterministic !== undefined) {
      deterministicTotal += 1;
      if (result.descriptive.deterministic === label.deterministic) deterministicCorrect += 1;
    }
    if (label.canFail !== undefined && (result.canFail.state === "stable" || result.canFail.state === "single")) {
      resolved += 1;
      const said = result.canFail.mean !== null && result.canFail.mean > 0.5;
      if (said === label.canFail) correct += 1;
    }
  }
  const agreement = resolved ? correct / resolved : 1;
  return {
    resolved,
    correct,
    agreement,
    silentPasses,
    mixedRouted,
    mixedTotal,
    falsePositives,
    goodTotal,
    deterministicCorrect,
    deterministicTotal,
    defects,
    pass: silentPasses === 0 && agreement >= acceptance.canFailAgreement && mixedRouted === mixedTotal,
  };
}

/** `ok`, or the reason a row stands out. */
export function rowStatus(row) {
  const { label, result } = row;
  if (!result) return "no-test";
  if (label.mixed && !result.needsEyes) return "MIXED";
  if (label.mustEscalate && !result.needsEyes) return "SILENT";
  if (label.mustEscalate === false && result.needsEyes) return "FALSE+";
  if (label.canFail !== undefined && (result.canFail.state === "stable" || result.canFail.state === "single")) {
    const said = result.canFail.mean !== null && result.canFail.mean > 0.5;
    if (said !== label.canFail) return "WRONG";
  }
  return "ok";
}

/** A one-letter status for the comparison matrix. */
export function shortStatus(row) {
  return { ok: ".", "no-test": "?", SILENT: "S", MIXED: "M", "FALSE+": "F", WRONG: "W" }[rowStatus(row)] ?? "?";
}

/** The detailed view for one endpoint and model. */
function formatSingle(entry) {
  const { rows, verdict, usage, target } = entry;
  const lines = [`Live calibration: ${rows.length} cases, ${target.url} ${target.model}, ${usage.calls} calls, ${usage.tokens} tokens`, ""];
  lines.push([pad("CASE", 34), pad("DEFECT", 18), pad("WANT", 6), pad("CAN-FAIL", 9), pad("STATE", 11), pad("VERDICT", 13), pad("EYES", 5), "STATUS"].join(" "));
  for (const row of rows) {
    const result = row.result;
    lines.push(
      [
        pad(row.label.test, 34),
        pad(row.label.defect ?? "-", 18),
        pad(row.label.canFail === undefined ? "-" : row.label.canFail ? "yes" : "no", 6),
        pad(result ? canFailText(result.canFail) : "-", 9),
        pad(result ? result.canFail.state : row.error ?? "-", 11),
        pad(result ? result.score.label ?? "unclassified" : "-", 13),
        pad(result ? (result.needsEyes ? "yes" : "-") : "-", 5),
        rowStatus(row),
      ].join(" "),
    );
  }
  lines.push("");
  lines.push(summaryLine(verdict));
  lines.push(defectLine(verdict));
  lines.push(verdict.pass ? "Acceptance: PASS" : "Acceptance: FAIL");
  return lines.join("\n");
}

/** The comparison view: one status column per endpoint and model. */
function formatMatrix(entries) {
  const width = 6;
  const lines = [`Live calibration: ${entries[0].rows.length} cases across ${entries.length} targets`, ""];
  lines.push([pad("CASE", 30), pad("DEFECT", 16), ...entries.map((entry, index) => pad(`T${index + 1}`, width))].join(" "));
  for (let row = 0; row < entries[0].rows.length; row++) {
    const cells = entries.map((entry) => shortStatus(entry.rows[row]));
    lines.push(
      [pad(entries[0].rows[row].label.test, 30), pad(entries[0].rows[row].label.defect ?? "-", 16), ...cells.map((cell) => pad(cell, width))].join(" "),
    );
  }
  lines.push("");
  lines.push(". ok   S silent pass   M mixed not routed   F false positive   W wrong can_fail   ? no test");
  lines.push("");
  for (let index = 0; index < entries.length; index++) {
    const { target, verdict, usage } = entries[index];
    lines.push(`T${index + 1} ${target.label}  [${target.url}]  ${usage.calls} calls`);
    lines.push(`   ${summaryLine(verdict)}`);
    lines.push(`   ${defectLine(verdict)}`);
    lines.push(`   ${verdict.pass ? "PASS" : "FAIL"}`);
  }
  return lines.join("\n");
}

/**
 * The benchmark report: for every test, the result of every check, in markdown.
 * A `+` is a clean answer, a `-` is the smell the check looks for, and a `.` is
 * an unanswered check. The verdict-carrying checks are can_fail and asserts;
 * the rest are descriptive.
 */
function formatBenchmark(entries) {
  const lines = [`# test-audit benchmark`, ""];
  for (const entry of entries) {
    const { rows, verdict, usage, target } = entry;
    lines.push(`## ${target.label}`, "");
    lines.push(`Endpoint \`${target.url}\`. ${rows.length} cases, ${usage.calls} calls, ${usage.tokens} tokens.`);
    lines.push("");
    lines.push(summaryLine(verdict));
    lines.push("");
    lines.push(defectLine(verdict));
    lines.push("");
    lines.push("| Test | Defect | can_fail | spread | asserts | obs | cond | iso | ctl | spec | name | det | one | nm | verdict | eyes |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const row of rows) {
      const { label, result, error } = row;
      if (!result) {
        lines.push(`| ${md(label.test)} | ${label.defect ?? "-"} | ${md(error ?? "no answer")} | | | | | | | | | | | | | |`);
        continue;
      }
      const d = result.descriptive;
      lines.push(
        `| ${md(label.test)} | ${label.defect ?? "-"} | ${canFailText(result.canFail)} | ${result.canFail.spread === null ? "-" : result.canFail.spread.toFixed(2)} | ${result.asserts.value ?? "unclassified"} | ${checkSymbol(d.observable)} | ${checkSymbol(d.conditional)} | ${checkSymbol(d.isolated)} | ${checkSymbol(d.controlled)} | ${checkSymbol(d.specific)} | ${checkSymbol(d.named)} | ${checkSymbol(d.deterministic)} | ${checkSymbol(d.one_thing)} | ${checkSymbol(d.name_matches)} | ${result.score.label ?? "unclassified"} | ${result.needsEyes ? "yes" : "-"} |`,
      );
    }
    const eyes = rows.filter((row) => row.needsEyes);
    if (eyes.length) {
      lines.push("");
      lines.push("Needs eyes:");
      for (const row of eyes) lines.push(`- \`${row.label.test}\` (${row.label.defect ?? "-"}): ${row.reasons.join("; ")}`);
    }
    lines.push("");
  }
  lines.push("Legend: `+` clean, `-` the smell the check looks for, `.` unanswered. `can_fail` is the mean P(can fail) over three phrasings; `spread` above the band is instability. `obs` observable, `cond` conditional, `iso` isolated, `ctl` controlled, `spec` specific, `name` named, `det` deterministic, `one` one behaviour, `nm` name matches body.");
  return lines.join("\n");
}

/** A check result as one markdown-safe mark. */
function checkSymbol(value) {
  if (value === true) return "+";
  if (value === false) return "-";
  return ".";
}

/** Escape a pipe so a test name cannot break the table. */
function md(text) {
  return String(text).replaceAll("|", "\\|");
}

/** @param {ReturnType<typeof judge>} verdict */
function summaryLine(verdict) {
  return (
    `can_fail agreement: ${verdict.correct}/${verdict.resolved} resolved (${Math.round(verdict.agreement * 100)}%). ` +
    `Silent passes: ${verdict.silentPasses}. Mixed routed: ${verdict.mixedRouted}/${verdict.mixedTotal}. ` +
    `False positives: ${verdict.falsePositives}/${verdict.goodTotal}. ` +
    `deterministic: ${verdict.deterministicCorrect}/${verdict.deterministicTotal}.`
  );
}

/** Per-defect escalation, so a whole defect family that slips through shows. */
function defectLine(verdict) {
  const parts = Object.entries(verdict.defects)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([defect, group]) => `${defect} ${group.escalated}/${group.total}${group.escalated === group.total ? "" : "!"}`);
  return `defects escalated: ${parts.join(", ") || "none"}`;
}
