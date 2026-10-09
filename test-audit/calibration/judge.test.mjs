// Unit tests for the calibration scoring. `judge` and `rowStatus` are pure, so
// the rules that decide pass or fail are tested without a live endpoint.

import { test } from "node:test";
import assert from "node:assert/strict";
import { judge, rowStatus } from "./judge.mjs";
import { loadLabels, selectLabels } from "./labels.mjs";
import { codeContext } from "./case-state.mjs";
import { verdictFrom } from "../classifier/verdict.mjs";
import { assertsAs, goodAnswers, noul } from "../test-fixtures.mjs";

/** @typedef {import("../types.d.ts").AuditAnswer} AuditAnswer */
/** @typedef {import("../types.d.ts").CalibrationLabel} CalibrationLabel */
/** @typedef {import("../types.d.ts").CalibrationRow} CalibrationRow */

/**
 * A labelled row whose result the real verdict rules give for the answers. The
 * label's check and case file are derived from its test name.
 * @param {Omit<CalibrationLabel, "check" | "file">} label
 * @param {Record<string, AuditAnswer>} answers
 * @param {string} [error] a transport failure
 * @returns {CalibrationRow}
 */
function row(label, answers, error) {
  const test = { file: `${label.test}.test.mjs`, line: 1, name: label.test, path: [], scope: [], source: "", fixtures: [], imports: [], flags: [] };
  return { label: { check: "verdict", file: `checks/verdict/cases/${label.test}/case.mjs`, ...label }, result: verdictFrom(test, answers, { error }) };
}

/** A real guard: it can fail, and nothing escalates. */
const GOOD = goodAnswers();
/** A stable "cannot fail": the phrasings agree, so the tool commits to no. It escalates. */
const CANNOT_FAIL = { ...GOOD, can_fail_a: noul(0.1), can_fail_c: noul(0.1), ...assertsAs("inexact") };
/** A good can_fail beside an expected value from the code, a slop verdict: it escalates. */
const SLOP = { ...GOOD, ...assertsAs("from-code") };
/** Phrasings that disagree beyond the band: the tool commits to no value. */
const UNSTABLE = { ...GOOD, can_fail_a: noul(0.9), can_fail_c: noul(0.1) };

test("a clean run passes", () => {
  const rows = [row({ test: "slop", canFail: false, mustEscalate: true }, CANNOT_FAIL), row({ test: "good", canFail: true, mustEscalate: false }, GOOD)];
  const verdict = judge(rows);
  assert.equal(verdict.pass, true);
  assert.equal(verdict.correct, 2);
  assert.equal(verdict.silentPasses, 0);
});

test("a silent pass fails the run", () => {
  const verdict = judge([row({ test: "slop", mustEscalate: true }, GOOD)]);
  assert.equal(verdict.silentPasses, 1);
  assert.equal(verdict.pass, false);
});

test("an unrouted mixed case fails the run", () => {
  const verdict = judge([row({ test: "mixed", mixed: true, mustEscalate: true }, GOOD)]);
  assert.equal(verdict.mixedTotal, 1);
  assert.equal(verdict.mixedRouted, 0);
  assert.equal(verdict.pass, false);
});

test("a reply whose answer slots carry no value is unanswered, not a pass", () => {
  // An endpoint that reports no mass can send the slots with no value in any
  // of them. That is no answer: it must land in unresolved, so acceptance
  // fails on it instead of passing on 0 of 0.
  const empty = Object.fromEntries(Object.keys(GOOD).map((key) => [key, {}]));
  const verdict = judge([row({ test: "slop", canFail: false, mustEscalate: true }, empty)]);
  assert.equal(verdict.unresolved, 1);
  assert.equal(verdict.pass, false);
});

test("agreement counts only the cases the tool resolved", () => {
  const rows = [row({ test: "a", canFail: true }, GOOD), row({ test: "b", canFail: false }, CANNOT_FAIL), row({ test: "c", canFail: true }, UNSTABLE)];
  const verdict = judge(rows);
  assert.equal(verdict.resolved, 2);
  assert.equal(verdict.correct, 2);
  assert.equal(verdict.agreement, 1);
});

test("rowStatus names the notable rows", () => {
  assert.equal(rowStatus(row({ test: "x" }, GOOD)), "ok");
  assert.equal(rowStatus(row({ test: "x", mustEscalate: true }, GOOD)), "SILENT");
  assert.equal(rowStatus(row({ test: "x", mixed: true, mustEscalate: true }, GOOD)), "MIXED");
  assert.equal(rowStatus(row({ test: "x", mustEscalate: false }, SLOP)), "FALSE+");
  assert.equal(rowStatus(row({ test: "x", canFail: true }, CANNOT_FAIL)), "WRONG");
});

test("judge groups escalation by defect, so a whole family that slips shows", () => {
  const rows = [
    row({ test: "a", defect: "tautology", mustEscalate: true }, SLOP),
    row({ test: "b", defect: "tautology", mustEscalate: true }, SLOP),
    row({ test: "c", defect: "shape-only", mustEscalate: true }, GOOD),
  ];
  const verdict = judge(rows);
  assert.deepEqual(verdict.defects.tautology, { total: 2, escalated: 2 });
  assert.deepEqual(verdict.defects["shape-only"], { total: 1, escalated: 0 });
  assert.equal(verdict.silentPasses, 1);
  assert.equal(verdict.pass, false);
});

test("judge holds the run to the acceptance bar", () => {
  const verdict = judge([row({ test: "a", canFail: true }, GOOD), row({ test: "b", canFail: true }, CANNOT_FAIL)]);
  assert.equal(verdict.minAgreement, 0.9);
  assert.equal(verdict.pass, false);
});

test("each check a label names is scored against the label", () => {
  const rows = [
    row(/** @type {any} */ ({ test: "a", deterministic: true, asserts: "behaviour" }), GOOD),
    row(/** @type {any} */ ({ test: "b", deterministic: true }), { ...GOOD, deterministic: noul(0.1) }),
    row(/** @type {any} */ ({ test: "c", restores: false }), GOOD),
  ];
  const verdict = judge(rows);
  assert.deepEqual(verdict.checkAnswers, { asserts: { correct: 1, total: 1 }, deterministic: { correct: 1, total: 2 }, restores: { correct: 0, total: 1 } });
  assert.deepEqual(rows.map(rowStatus), ["ok", "CHECK", "CHECK"]);
  // A check value that differs is reported, not an acceptance failure.
  assert.equal(verdict.pass, true);
});

test("a labelled check that did not commit is not counted as wrong", () => {
  const rows = [row(/** @type {any} */ ({ test: "a", positive: true }), { ...GOOD, positive_a: noul(0.9), positive_b: noul(0.1) })];
  assert.deepEqual(judge(rows).checkAnswers, {});
  assert.ok(rowStatus(rows[0]) !== "CHECK");
});

test("loadLabels gives each label its check and its case file from the folder", () => {
  const labels = loadLabels();
  assert.ok(labels.length >= 18);
  for (const label of labels) {
    assert.match(label.file, new RegExp(`^checks/${label.check}/cases/[^/]+/case\\.mjs$`));
    assert.ok(typeof label.test === "string");
  }
  assert.ok(labels.some((label) => label.defect === "tautology"));
});

test("a label that resolves to no test fails the run", () => {
  const rows = [{ label: { check: "verdict", file: "checks/verdict/cases/missing/case.mjs", test: "missing", mustEscalate: true }, error: "test not found: missing" }];
  const verdict = judge(rows);
  assert.equal(verdict.unresolved, 1);
  assert.equal(verdict.pass, false);
});

test("a reply with no trusted answer fails the run too", () => {
  // A 200 with an empty `answers`, or every answer below the mass floor.
  const untrusted = Object.fromEntries(Object.entries(GOOD).map(([key, answer]) => [key, { ...answer, mass: 0.01 }]));
  const rows = [row({ test: "empty", canFail: false, mustEscalate: true }, {}), row({ test: "untrusted", canFail: false, mustEscalate: true }, untrusted)];
  const verdict = judge(rows);
  assert.equal(verdict.unresolved, 2);
  assert.equal(verdict.pass, false);
});

test("agreement counts a can-fail value only when every phrasing answered", () => {
  const { can_fail_c: _c, ...single } = CANNOT_FAIL;
  const partial = row({ test: "a", canFail: true }, single);
  const verdict = judge([partial]);
  assert.equal(verdict.resolved, 0);
  assert.equal(rowStatus(partial), "ok");
});

test("a mean of exactly 0.5 is undecided and escalates, as the audit reads it", () => {
  const verdict = judge([row({ test: "a", canFail: true }, { ...GOOD, can_fail_a: noul(0.5), can_fail_c: noul(0.5) })]);
  assert.equal(verdict.correct, 0);
  assert.equal(verdict.resolved, 0);
});

test("a case the endpoint never answered fails the run", () => {
  // A transport failure escalates, so without this rule a dead endpoint would
  // route every defect case and pass with 0/0 agreement.
  const rows = [row({ test: "slop", canFail: false, mustEscalate: true }, {}, "fetch failed"), row({ test: "mixed", mixed: true, mustEscalate: true }, {}, "fetch failed")];
  const verdict = judge(rows);
  assert.equal(verdict.unresolved, 2);
  assert.equal(verdict.pass, false);
  assert.equal(rowStatus(rows[0]), "ERROR");
});

test("the runner sends the code under test as a new-file diff at a neutral path", () => {
  const diff = codeContext("export const a = 1;\n");
  assert.equal(diff, "diff --git a/src/example.mjs b/src/example.mjs\nnew file mode 100644\n--- /dev/null\n+++ b/src/example.mjs\n@@ -0,0 +1,1 @@\n+export const a = 1;");
});

test("selectLabels picks cases by folder or test name, and rejects a name that matches nothing", () => {
  const labels = loadLabels();
  assert.deepEqual(
    selectLabels(labels, ["result-keys"]).map((label) => label.test),
    ["loads the profile fields"],
  );
  assert.deepEqual(
    selectLabels(labels, ["adds two numbers"]).map((label) => label.file),
    ["checks/verdict/cases/pure-add/case.mjs"],
  );
  assert.equal(selectLabels(labels, undefined).length, labels.length);
  assert.throws(() => selectLabels(labels, ["no-such-case"]), /no case matches: no-such-case/);
});

test("a false positive counts as sure only when its finding is sure", () => {
  const clean = /** @type {any} */ ({ test: "a", mustEscalate: false, canFail: true });
  const rows = [
    // A firm "no positive assertion" on a clean case: the reader would act on a sound test.
    row(clean, { ...GOOD, positive_a: noul(0.05), positive_b: noul(0.05) }),
    // Phrasings that disagree: a look, marked unsure.
    row(clean, { ...GOOD, can_fail_a: noul(0.95), can_fail_c: noul(0.3) }),
  ];
  const verdict = judge(rows);
  assert.equal(verdict.falsePositives, 2);
  assert.equal(verdict.sureFalsePositives, 1);
});
