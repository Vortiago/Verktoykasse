// Unit tests for the report shapes and the exit contract.

import { test } from "node:test";
import assert from "node:assert/strict";
import { exitCode, formatText, formatJson, formatMarkdown } from "./report.mjs";

/** A minimal verdict record; only the fields the report reads are filled. */
function result(overrides = {}) {
  return {
    test: { file: "add.test.mjs", line: 1, name: "adds", path: [] },
    canFail: { values: [0.99, 0.99, 0.98], mean: 0.99, spread: 0.01, state: "stable" },
    asserts: { value: "behaviour", a: "behaviour", b: "behaviour", trust: true, agrees: true },
    type: "unit",
    deterministic: true,
    oneThing: true,
    nameMatches: true,
    score: { value: 3, label: "strong" },
    flags: [],
    needsEyes: false,
    reasons: [],
    ...overrides,
  };
}

test("exitCode is 0 only when nothing escalates", () => {
  assert.equal(exitCode([result()]), 0);
  assert.equal(exitCode([result(), result()]), 0);
  assert.equal(exitCode([result({ needsEyes: true, reasons: ["x"] })]), 1);
  assert.equal(exitCode([result({ score: { value: 1, label: "weak" } })]), 1);
  assert.equal(exitCode([result({ score: { value: 0, label: "slop" } })]), 1);
});

test("formatText names the escalated test and its reasons", () => {
  const text = formatText([result(), result({ test: { file: "bar.test.mjs", line: 3, name: "sane", path: [] }, score: { value: 0, label: "slop" }, needsEyes: true, reasons: ["can_fail unstable (spread 0.91)"] })], { ref: "origin/main...HEAD" });
  assert.match(text, /Audit of origin\/main\.\.\.HEAD/);
  assert.match(text, /slop/);
  assert.match(text, /Needs eyes:/);
  assert.match(text, /can_fail unstable/);
  assert.match(text, /Summary: 1 strong, 1 slop\. 0 unstable\. 1 needs eyes\./);
});

test("formatJson emits the full record", () => {
  const json = JSON.parse(formatJson([result()], { ref: "HEAD", usage: { calls: 1, tokens: 5 } }));
  assert.equal(json.results.length, 1);
  assert.equal(json.results[0].score.label, "strong");
  assert.equal(json.usage.calls, 1);
});

test("formatMarkdown emits a table and an escalation list", () => {
  const md = formatMarkdown([result({ needsEyes: true, reasons: ["asserts nothing"] })], { ref: "HEAD" });
  assert.match(md, /\| Verdict \| Eyes \|/);
  assert.match(md, /### Needs eyes/);
  assert.match(md, /asserts nothing/);
});
