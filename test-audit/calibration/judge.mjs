// The calibration rules. Only these are hard: no labelled defect case passes
// silently, every mixed case routes to eyes, and every label resolves to a test
// that the endpoint answered.
// Agreement is measured only where the tool committed to a can-fail value; an
// unstable case routed to a human is the design working, not a wrong answer.
// Pure, so the scoring is tested without a model.

/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").CalibrationRow} CalibrationRow */

/** The acceptance bar: the least share of committed can_fail answers that must match the label. */
const ACCEPTANCE = { canFailAgreement: 0.9 };

/**
 * @param {CalibrationRow[]} rows
 * @param {{ canFailAgreement: number }} [acceptance]
 */
export function judge(rows, acceptance = ACCEPTANCE) {
  let resolved = 0;
  let correct = 0;
  let silentPasses = 0;
  let mixedRouted = 0;
  let mixedTotal = 0;
  let falsePositives = 0;
  let goodTotal = 0;
  let deterministicCorrect = 0;
  let deterministicTotal = 0;
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
    }
    if (label.deterministic !== undefined && result.descriptive.deterministic !== undefined) {
      deterministicTotal += 1;
      if (result.descriptive.deterministic === label.deterministic) deterministicCorrect += 1;
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
    goodTotal,
    deterministicCorrect,
    deterministicTotal,
    unresolved,
    defects,
    minAgreement: acceptance.canFailAgreement,
    pass: silentPasses === 0 && unresolved === 0 && agreement >= acceptance.canFailAgreement && mixedRouted === mixedTotal,
  };
}

/**
 * Did the endpoint answer: no transport failure, and at least one trusted
 * verdict-carrying answer? @param {AuditResult} result
 */
function answered(result) {
  if (result.error) return false;
  const { canFail, asserts, score } = result;
  return canFail.mean !== null || asserts.trust || asserts.a !== undefined || asserts.b !== undefined || score.value !== undefined || result.runs !== undefined || result.positive !== undefined;
}

/**
 * The can-fail answer the tool committed to, or undefined when it routed. It
 * commits only when every phrasing answered within the band (a partial answer
 * escalates as "not fully answered"), and reads the mean as verdict.mjs does.
 * @param {AuditResult} result
 */
export function saidCanFail(result) {
  const { state, values, mean } = result.canFail;
  if (state !== "stable" || mean === null || values.some((value) => value === null)) return undefined;
  return mean >= 0.5;
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
  return "ok";
}

/** A one-letter status for the comparison matrix. @param {CalibrationRow} row */
export function shortStatus(row) {
  return { ok: ".", "no-test": "?", ERROR: "E", SILENT: "S", MIXED: "M", "FALSE+": "F", WRONG: "W" }[rowStatus(row)] ?? "?";
}