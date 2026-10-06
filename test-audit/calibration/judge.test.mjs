// Unit tests for the calibration scoring. `judge` and `rowStatus` are pure, so
// the rules that decide pass or fail are tested without a live endpoint.

import { test } from "node:test";
import assert from "node:assert/strict";
import { judge, rowStatus } from "./judge.mjs";
import { loadLabels } from "./labels.mjs";

/** A labelled row with a result whose can-fail mean and escalation are set. */
function row(label, { mean = 0.99, state = "stable", needsEyes = false } = {}) {
  return {
    label,
    result: {
      canFail: { mean, state, unstable: state === "borderline" || state === "unstable", values: [], spread: 0 },
      score: { label: needsEyes ? "weak" : "strong" },
      needsEyes,
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
  const rows = [{ label: { test: "missing", mustEscalate: true }, error: "test not found: missing" }];
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
