// The live calibration layer: run the labelled corpus against the real arbiter
// and report agreement. It is not part of the repo gate, because it needs the
// network, and it is the evidence that the gate model is trustworthy enough to
// wire a hook. Run it with `node cli.mjs --selftest`.
//
// The rules under test live in `judge`, which is pure, so the calibration
// scoring is itself unit-tested without the model.

import { readFileSync } from "node:fs";
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

/**
 * @param {{ config?: object, ask?: Function }} [opts]
 * @returns {Promise<{ text: string, code: number }>}
 */
export async function runSelftest(opts = {}) {
  const cfg = opts.config ?? config;
  const ask = opts.ask ?? systemoneAsk;
  const labels = JSON.parse(readFileSync(join(HERE, "corpus", "labels.json"), "utf8"));

  const usage = { calls: 0, tokens: 0 };
  const onResponse = (json) => {
    usage.calls += 1;
    usage.tokens += tokensOf(json.usage);
  };
  const rows = await mapPool(labels.cases, cfg.concurrency, (label) => runCase(label, { cfg, ask, onResponse }));
  const verdict = judge(rows, labels.acceptance);
  return { text: format(rows, verdict, usage), code: verdict.pass ? 0 : 1 };
}

/**
 * Classify one labelled case. The test is found by name, so a case file may
 * hold more than one test.
 * @param {any} label
 * @param {{ cfg: object, ask: Function, onResponse: (json: object) => void }} ctx
 */
async function runCase(label, ctx) {
  const text = readFileSync(join(HERE, "corpus", label.file), "utf8");
  const test = extractTests(text, label.file).find((candidate) => candidate.name === label.test);
  if (!test) return { label, error: `test not found: ${label.test}` };
  const smellFlags = [...findFileFlags(text), ...findSmells(test)];
  const result = await classify(test, { ask: ctx.ask, config: ctx.cfg, smellFlags, onResponse: ctx.onResponse });
  return { label, result };
}

/**
 * The calibration rules. Only two things are hard: no labelled slop case
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
  for (const row of rows) {
    const { label, result } = row;
    if (!result) {
      if (label.mustEscalate) silentPasses += 1;
      continue;
    }
    if (label.mustEscalate && !result.needsEyes) silentPasses += 1;
    if (label.mixed) {
      mixedTotal += 1;
      if (result.needsEyes) mixedRouted += 1;
    }
    if (label.mustEscalate === false) {
      goodTotal += 1;
      if (result.needsEyes) falsePositives += 1;
    }
    if (label.deterministic !== undefined && result.deterministic !== undefined) {
      deterministicTotal += 1;
      if (result.deterministic === label.deterministic) deterministicCorrect += 1;
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

/** @param {any[]} rows @param {ReturnType<typeof judge>} verdict @param {{calls: number, tokens: number}} usage */
function format(rows, verdict, usage) {
  const lines = [`Live calibration: ${rows.length} cases, ${usage.calls} calls, ${usage.tokens} tokens`, ""];
  lines.push([pad("CASE", 30), pad("WANT", 6), pad("CAN-FAIL", 9), pad("STATE", 11), pad("VERDICT", 13), pad("EYES", 5), "STATUS"].join(" "));
  for (const row of rows) {
    const result = row.result;
    lines.push(
      [
        pad(row.label.test, 30),
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
  lines.push(
    `can_fail agreement: ${verdict.correct}/${verdict.resolved} resolved (${Math.round(verdict.agreement * 100)}%). ` +
      `Silent passes: ${verdict.silentPasses}. Mixed routed: ${verdict.mixedRouted}/${verdict.mixedTotal}. ` +
      `False positives: ${verdict.falsePositives}/${verdict.goodTotal}. ` +
      `deterministic: ${verdict.deterministicCorrect}/${verdict.deterministicTotal}.`,
  );
  lines.push(verdict.pass ? "Acceptance: PASS" : "Acceptance: FAIL");
  return lines.join("\n");
}

