// The calibration rules. Only these are hard: no labelled defect case passes
// silently, every mixed case routes to eyes, and every label resolves to a test.
// Agreement is measured only where the tool committed to a can-fail value; an
// unstable case routed to a human is the design working, not a wrong answer.
// Pure, so the scoring is tested without a model.

/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").CalibrationRow} CalibrationRow */

/**
 * @param {CalibrationRow[]} rows
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
  let unresolved = 0;
  /** @type {Record<string, { total: number, escalated: number }>} */
  const defects = {};
  for (const row of rows) {
    const { label, result } = row;
    if (!result) {
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
    pass: silentPasses === 0 && unresolved === 0 && agreement >= acceptance.canFailAgreement && mixedRouted === mixedTotal,
  };
}

/** The can-fail answer the tool committed to, or undefined when it routed. @param {AuditResult} result */
function saidCanFail(result) {
  if (result.canFail.unstable || result.canFail.mean === null) return undefined;
  return result.canFail.mean > 0.5;
}

/** `ok`, or the reason a row stands out. @param {CalibrationRow} row */
export function rowStatus(row) {
  const { label, result } = row;
  if (!result) return "no-test";
  if (label.mixed && !result.needsEyes) return "MIXED";
  if (label.mustEscalate && !result.needsEyes) return "SILENT";
  if (label.mustEscalate === false && result.needsEyes) return "FALSE+";
  const said = saidCanFail(result);
  if (label.canFail !== undefined && said !== undefined && said !== label.canFail) return "WRONG";
  return "ok";
}

/** A one-letter status for the comparison matrix. @param {CalibrationRow} row */
export function shortStatus(row) {
  return { ok: ".", "no-test": "?", SILENT: "S", MIXED: "M", "FALSE+": "F", WRONG: "W" }[rowStatus(row)] ?? "?";
}