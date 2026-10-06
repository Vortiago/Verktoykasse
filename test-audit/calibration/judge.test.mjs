// Unit tests for the calibration scoring. `judge` and `rowStatus` are pure, so
// the rules that decide pass or fail are tested without a live endpoint.

import { test } from "node:test";
import assert from "node:assert/strict";
import { judge, rowStatus } from "./judge.mjs";
import { loadLabels } from "./labels.mjs";

/** @typedef {import("../types.d.ts").CalibrationLabel} CalibrationLabel */
/** @typedef {import("../types.d.ts").CalibrationRow} CalibrationRow */

/**
 * A labelled row with a result whose can-fail mean and escalation are set. The
 * judge reads only those, so the rest of the result is empty, and the label's
 * case file is derived from its test name.
 * @param {Omit<CalibrationLabel, "file">} label
 * @param {{ mean?: number | null, state?: string, needsEyes?: boolean, error?: string }} [opts]
 * @returns {CalibrationRow}
 */
function row(label, { mean = 0.99, state = "stable", needsEyes = false, error } = {}) {
  return {
    label: { file: `cases/${label.test}.case.mjs`, ...label },
    result: {
      test: { file: `${label.test}.test.mjs`, line: 1, name: label.test, path: [] },
      answers: {},
      canFail: { mean, state, unstable: state === "borderline" || state === "unstable", values: [], spread: 0 },
      asserts: { trust: true, agrees: true },
      descriptive: {},
      score: { label: needsEyes ? "weak" : "strong" },
      flags: [],
      needsEyes,
      reasons: [],
      error,
    },
  };
}

test("a clean run passes", () => {
  const rows = [
    row({ test: "slop", canFail: false, mustEscalate: true }, { mean: 0.1, needsEyes: true }),
    row({ test: "good", canFail: true, mustEscalate: false }, { mean: 0.99, needsEyes: false }),
  ];
  const verdict = judge(rows, { canFailAgreement: 0.9 });
  assert.equal(verdict.pass, true);
  assert.equal(verdict.correct, 2);
  assert.equal(verdict.silentPasses, 0);
});

test("a silent pass fails the run", () => {
  const rows = [row({ test: "slop", mustEscalate: true }, { needsEyes: false })];
  const verdict = judge(rows, { canFailAgreement: 0.9 });
  assert.equal(verdict.silentPasses, 1);
  assert.equal(verdict.pass, false);
});

test("an unrouted mixed case fails the run", () => {
  const rows = [row({ test: "mixed", mixed: true, mustEscalate: true }, { needsEyes: false })];
  const verdict = judge(rows, { canFailAgreement: 0.9 });
  assert.equal(verdict.mixedTotal, 1);
  assert.equal(verdict.mixedRouted, 0);
  assert.equal(verdict.pass, false);
});

test("agreement counts only the cases the tool resolved", () => {
  const rows = [
    row({ test: "a", canFail: true }, { mean: 0.99 }),
    row({ test: "b", canFail: false }, { mean: 0.1 }),
    row({ test: "c", canFail: true }, { mean: 0.3, state: "unstable", needsEyes: true }),
  ];
  const verdict = judge(rows, { canFailAgreement: 0.9 });
  assert.equal(verdict.resolved, 2);
  assert.equal(verdict.correct, 2);
  assert.equal(verdict.agreement, 1);
});

test("rowStatus names the notable rows", () => {
  assert.equal(rowStatus(row({ test: "x" })), "ok");
  assert.equal(rowStatus(row({ test: "x", mustEscalate: true }, { needsEyes: false })), "SILENT");
  assert.equal(rowStatus(row({ test: "x", mixed: true, mustEscalate: true }, { needsEyes: false })), "MIXED");
  assert.equal(rowStatus(row({ test: "x", mustEscalate: false }, { needsEyes: true })), "FALSE+");
  assert.equal(rowStatus(row({ test: "x", canFail: true }, { mean: 0.2 })), "WRONG");
});

test("judge groups escalation by defect, so a whole family that slips shows", () => {
  const rows = [
    row({ test: "a", defect: "tautology", mustEscalate: true }, { needsEyes: true }),
    row({ test: "b", defect: "tautology", mustEscalate: true }, { needsEyes: true }),
    row({ test: "c", defect: "shape-only", mustEscalate: true }, { needsEyes: false }),
  ];
  const verdict = judge(rows, { canFailAgreement: 0.9 });
  assert.deepEqual(verdict.defects.tautology, { total: 2, escalated: 2 });
  assert.deepEqual(verdict.defects["shape-only"], { total: 1, escalated: 0 });
  assert.equal(verdict.silentPasses, 1);
  assert.equal(verdict.pass, false);
});

test("loadLabels merges every fragment", () => {
  const { acceptance, cases } = loadLabels();
  assert.equal(typeof acceptance.canFailAgreement, "number");
  assert.ok(cases.length >= 18);
  for (const label of cases) {
    assert.ok(typeof label.file === "string" && label.file.startsWith("cases/"));
    assert.ok(typeof label.test === "string");
  }
  assert.ok(cases.some((label) => label.defect === "tautology"));
});

test("a label that resolves to no test fails the run", () => {
  const rows = [{ label: { file: "cases/missing.case.mjs", test: "missing", mustEscalate: true }, error: "test not found: missing" }];
  const verdict = judge(rows, { canFailAgreement: 0.9 });
  assert.equal(verdict.unresolved, 1);
  assert.equal(verdict.pass, false);
});

test("agreement excludes a stable case with no mean", () => {
  const rows = [row({ test: "a", canFail: true }, { mean: null, state: "stable" })];
  const verdict = judge(rows, { canFailAgreement: 0.9 });
  assert.equal(verdict.resolved, 0);
  assert.equal(verdict.agreement, 1);
});

test("a reply with no trusted answer fails the run too", () => {
  // A 200 with an empty `answers`, or every answer below the mass floor.
  const rows = [row({ test: "slop", canFail: false, mustEscalate: true }, { mean: null, state: "unanswered", needsEyes: true })];
  const [only] = rows;
  if (only.result) {
    only.result.asserts = { trust: false, agrees: false };
    only.result.score = {};
  }
  const verdict = judge(rows, { canFailAgreement: 0.9 });
  assert.equal(verdict.unresolved, 1);
  assert.equal(verdict.pass, false);
});

test("agreement counts a can-fail value only when every phrasing answered", () => {
  const partial = row({ test: "a", canFail: false }, { mean: 0.92, state: "single" });
  const twoOfThree = row({ test: "b", canFail: false }, { mean: 0.9, state: "stable" });
  if (twoOfThree.result) twoOfThree.result.canFail.values = [0.9, 0.9, null];
  const verdict = judge([partial, twoOfThree], { canFailAgreement: 0.9 });
  assert.equal(verdict.resolved, 0);
  assert.equal(rowStatus(partial), "ok");
});

test("a mean of exactly 0.5 reads as can fail, as the audit reads it", () => {
  const verdict = judge([row({ test: "a", canFail: true }, { mean: 0.5 })], { canFailAgreement: 0.9 });
  assert.equal(verdict.correct, 1);
});

test("a case the endpoint never answered fails the run", () => {
  // A transport failure escalates, so without this rule a dead endpoint would
  // route every defect case and pass with 0/0 agreement.
  const rows = [
    row({ test: "slop", canFail: false, mustEscalate: true }, { mean: null, state: "unanswered", needsEyes: true, error: "fetch failed" }),
    row({ test: "mixed", mixed: true, mustEscalate: true }, { mean: null, state: "unanswered", needsEyes: true, error: "fetch failed" }),
  ];
  const verdict = judge(rows, { canFailAgreement: 0.9 });
  assert.equal(verdict.unresolved, 2);
  assert.equal(verdict.pass, false);
  assert.equal(rowStatus(rows[0]), "ERROR");
});
