// The calibration rules. Only these are hard: no labelled defect case passes
// silently, every mixed case routes to eyes, and every label resolves to a test
// that the endpoint answered.
// Agreement is measured only where the tool committed to a value: the can_fail
// value, and the value of each check a label names. An unstable case routed to a
// human is the design working, not a wrong answer. Only can_fail agreement is an
// acceptance rule; a check value that differs from its label shows as CHECK.
// Pure, so the scoring is tested without a model.

import { CHECKS } from "../checks/index.mjs";
import { labelChecks } from "./labels.mjs";
import { trusted } from "../classifier/systemone.mjs";
import { findingOf } from "../classifier/finding.mjs";

/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").CalibrationRow} CalibrationRow */

/** The acceptance bar: the least share of committed can_fail answers that must match the label. */
const ACCEPTANCE = { canFailAgreement: 0.9 };

/** The check whose value the `canFail` of a label states. */
const CAN_FAIL = CHECKS.find((check) => check.role === "can-fail");

/** @param {CalibrationRow[]} rows */
export function judge(rows) {
  let resolved = 0;
  let correct = 0;
  let silentPasses = 0;
  let mixedRouted = 0;
  let mixedTotal = 0;
  let falsePositives = 0;
  let sureFalsePositives = 0;
  let goodTotal = 0;
  /** Per check: the labelled values the tool committed to, and how many match.
   * @type {Record<string, { correct: number, total: number }>} */
  const checkAnswers = {};
  let unresolved = 0;
  /** @type {Record<string, { total: number, escalated: number }>} */
  const defects = {};
  for (const row of rows) {
    const { label, result } = row;
    // No test, or no answer: a transport failure or a reply with no trusted
    // answer escalates in an audit, but here it measured nothing, so it must not
    // count as a routed defect case.
    if (!result || !answered(result)) {
      unresolved += 1;
      continue;
    }
    if (label.mustEscalate) {
      const group = defects[label.defect ?? "other"] ?? { total: 0, escalated: 0 };
      group.total += 1;
      if (result.needsEyes) group.escalated += 1;
      else silentPasses += 1;
      defects[label.defect ?? "other"] = group;
    }
    if (label.mixed) {
      mixedTotal += 1;
      if (result.needsEyes) mixedRouted += 1;
    }
    if (label.mustEscalate === false) {
      goodTotal += 1;
      if (result.needsEyes) falsePositives += 1;
      // The costly kind: the finding tells the reader to act, and says it is sure.
      if (result.needsEyes && findingOf(result).sure) sureFalsePositives += 1;
    }
    for (const [name, expected] of labelChecks(label)) {
      const value = result.checks[name]?.value;
      if (value === undefined) continue;
      const tally = (checkAnswers[name] ??= { correct: 0, total: 0 });
      tally.total += 1;
      if (value === expected) tally.correct += 1;
    }
    const said = saidCanFail(result);
    if (label.canFail !== undefined && said !== undefined) {
      resolved += 1;
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
    sureFalsePositives,
    goodTotal,
    checkAnswers,
    unresolved,
    defects,
    minAgreement: ACCEPTANCE.canFailAgreement,
    pass: silentPasses === 0 && unresolved === 0 && agreement >= ACCEPTANCE.canFailAgreement && mixedRouted === mixedTotal,
  };
}

/**
 * Did the endpoint answer: no transport failure, and at least one trusted
 * answer that a check reads? @param {AuditResult} result
 */
function answered(result) {
  if (result.error) return false;
  // The answers, not the checks: a check that reads only the extractor's flags,
  // such as runs, has a value with no answer at all.
  return Object.values(result.answers).some((answer) => trusted(answer));
}

/**
 * The can-fail answer the tool committed to, or undefined when it routed: the
 * value of the can-fail check. It commits only when every phrasing answered
 * and they agree (a partial answer escalates as "not fully answered").
 * @param {AuditResult} result
 */
export function saidCanFail(result) {
  const value = CAN_FAIL && result.checks[CAN_FAIL.name]?.value;
  return typeof value === "boolean" ? value : undefined;
}

/** `ok`, or the reason a row stands out. @param {CalibrationRow} row */
export function rowStatus(row) {
  const { label, result } = row;
  if (!result) return "no-test";
  if (!answered(result)) return "ERROR";
  if (label.mixed && !result.needsEyes) return "MIXED";
  if (label.mustEscalate && !result.needsEyes) return "SILENT";
  if (label.mustEscalate === false && result.needsEyes) return "FALSE+";
  const said = saidCanFail(result);
  if (label.canFail !== undefined && said !== undefined && said !== label.canFail) return "WRONG";
  if (wrongChecks(row).length) return "CHECK";
  return "ok";
}

/** A one-letter status for the comparison matrix. @param {CalibrationRow} row */
export function shortStatus(row) {
  return { ok: ".", "no-test": "?", ERROR: "E", SILENT: "S", MIXED: "M", "FALSE+": "F", WRONG: "W", CHECK: "C" }[rowStatus(row)] ?? "?";
}
/**
 * The labelled checks the tool committed to a different value for. A check
 * that did not commit (unanswered, or its phrasings disagree) is not wrong: it
 * escalated, which is the design working.
 * @param {CalibrationRow} row
 * @returns {Array<{ name: string, expected: boolean | string, value: unknown }>}
 */
export function wrongChecks(row) {
  const { label, result } = row;
  if (!result) return [];
  return labelChecks(label)
    .map(([name, expected]) => ({ name, expected, value: result.checks[name]?.value }))
    .filter(({ expected, value }) => value !== undefined && value !== expected);
}
