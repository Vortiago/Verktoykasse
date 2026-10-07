// Unit tests for the finding rules, on results that the verdict rules build
// from hand-written answers.

import { test } from "node:test";
import assert from "node:assert/strict";
import { findingOf } from "./finding.mjs";
import { verdictFrom } from "./verdict.mjs";
import { choice, goodAnswers, noul, score } from "../test-fixtures.mjs";

const TEST = { file: "a.test.mjs", line: 1, name: "adds", path: [], source: "", fixtures: [], setup: [], imports: [], scope: [], flags: [] };

/** @param {Record<string, any>} overrides @param {{ flags?: string[] }} [test] */
const findingFor = (overrides, test = {}) => findingOf(verdictFrom({ ...TEST, ...test }, { ...goodAnswers(), ...overrides }));

test("a clean test is ok", () => {
  assert.deepEqual(findingFor({}), { action: "ok", reasons: [], sure: true });
});

test("a test that cannot fail is dropped, and a confident answer is sure", () => {
  const finding = findingFor({ can_fail_a: noul(0.02), can_fail_b: noul(0.97), can_fail_c: noul(0.03), verdict: score(0) });
  assert.equal(finding.action, "drop");
  assert.deepEqual(finding.reasons, ["cannot fail", "slop guard"]);
  assert.equal(finding.sure, true);
});

test("a shape-only assertion needs a fix", () => {
  const finding = findingFor({ asserts_a: choice("shape-only"), asserts_b: choice("shape-only"), verdict: score(1) });
  assert.equal(finding.action, "fix");
  assert.deepEqual(finding.reasons, ["asserts only the shape", "weak guard"]);
});

test("a firm answer near the boundary is a fix, but unsure", () => {
  const finding = findingFor({ positive_a: noul(0.4), positive_b: noul(0.6) });
  assert.equal(finding.action, "fix");
  assert.deepEqual(finding.reasons, ["no positive assertion"]);
  assert.equal(finding.sure, false);
});

test("phrasings that disagree are a look, and never sure", () => {
  const finding = findingFor({ can_fail_a: noul(0.95), can_fail_b: noul(0.7), can_fail_c: noul(0.98) });
  assert.equal(finding.action, "look");
  assert.match(finding.reasons[0], /can_fail unstable/);
  assert.equal(finding.sure, false);
});

test("a flaky but otherwise sound test needs a fix", () => {
  const finding = findingFor({ deterministic: noul(0.1) });
  assert.deepEqual(finding, { action: "fix", reasons: ["flaky"], sure: true });
});

test("a call that failed is a look", () => {
  const result = verdictFrom(TEST, {}, { error: "fetch failed" });
  assert.deepEqual(findingOf(result), { action: "look", reasons: ["no answer (fetch failed)"], sure: false });
});

test("a reason that no check owns, such as a file with no readable test, is a look", () => {
  const result = { ...verdictFrom(TEST, goodAnswers()), needsEyes: true, reasons: ["no test found: the file's tests use a form the extractor cannot read"] };
  assert.deepEqual(findingOf(result), { action: "look", reasons: ["no test found: the file's tests use a form the extractor cannot read"], sure: false });
});

test("an assert kind the phrasings give a low probability is not sure", () => {
  const low = (/** @type {string} */ kind) => ({ ...choice(kind), probabilities: { [kind]: 0.59, behaviour: 0.3 } });
  const finding = findingFor({ asserts_a: low("shape-only"), asserts_b: low("shape-only") });
  assert.deepEqual(finding, { action: "fix", reasons: ["asserts only the shape"], sure: false });
});
