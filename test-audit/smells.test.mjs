// Unit tests for the static smells. Each flag names a catalogue pattern, so
// these tests also document what the scan does and does not see.

import { test } from "node:test";
import assert from "node:assert/strict";
import { findSmells, findFileFlags, HARD_FLAGS } from "./smells.mjs";
import { extractTests } from "./extract.mjs";

/** Smell the first test in `text`. */
function smellsOf(text) {
  return findSmells(extractTests(text, "x.test.mjs")[0]);
}

test("skipped and todo tests are flagged", () => {
  assert.deepEqual(smellsOf('test.skip("a", () => { expect(1).toBe(1); });'), ["skipped"]);
  assert.deepEqual(smellsOf('test.todo("a");'), ["skipped", "empty"]);
  assert.deepEqual(smellsOf('xit("a", () => { expect(1).toBe(1); });'), ["skipped"]);
});

test("a commented-out assertion is flagged", () => {
  assert.deepEqual(smellsOf('test("a", () => {\n  // expect(add(1, 2)).toBe(3);\n  expect(true).toBe(true);\n});'), ["commented-assert"]);
});

test("an empty test body is flagged", () => {
  assert.deepEqual(smellsOf('test("a", () => {});'), ["empty"]);
});

test("a test with no assertion and no throw is unknown", () => {
  assert.deepEqual(smellsOf('test("a", () => { setup(); });'), ["unknown"]);
  assert.deepEqual(smellsOf('test("a", () => { setup(); expect(value).toBe(1); });'), []);
});

test("a test that only throws counts as asserting", () => {
  assert.deepEqual(smellsOf('test("a", () => { if (bad()) throw new Error("bad"); });'), []);
});

test("a skip marker or an expect inside a string is not counted", () => {
  assert.deepEqual(
    smellsOf('test("records a skip", () => { const s = \'test.skip("later", () => {})\'; expect(s).toBeTruthy(); });'),
    [],
  );
  assert.deepEqual(smellsOf('test("a", () => { const s = "expect(x).toBe(1)"; });'), ["unknown"]);
});

test("an expression-bodied test is not reported empty", () => {
  assert.deepEqual(smellsOf('test("a", () => expect(x).toBe(1));'), []);
});

test("several assertions without a message is roulette", () => {
  assert.deepEqual(smellsOf('test("a", () => { expect(a).toBe(1); expect(b).toBe(2); });'), ["roulette"]);
  assert.deepEqual(smellsOf('test("a", () => { expect(a, "a is one").toBe(1); expect(b).toBe(2); });'), []);
});

test("findFileFlags marks every test in a file that focuses the run", () => {
  assert.deepEqual(findFileFlags('it.only("a", () => {});'), ["focused"]);
  assert.deepEqual(findFileFlags('fit("a", () => {});'), ["focused"]);
  assert.deepEqual(findFileFlags('it("a", () => {});'), []);
});

test("hard flags are the ones that escalate without the model", () => {
  assert.deepEqual([...HARD_FLAGS].sort(), ["commented-assert", "empty", "focused", "skipped", "unknown"]);
});
