// Unit tests for the report shapes and the exit contract.

import { test } from "node:test";
import assert from "node:assert/strict";
import { exitCode, formatAudit, formatText, formatMarkdown, pad } from "./index.mjs";

/** @typedef {import("../types.d.ts").AuditResult} AuditResult */

/**
 * A verdict record for a clean test. The report reads only some of its fields;
 * the rest are empty.
 * @param {Partial<AuditResult>} [overrides]
 * @returns {AuditResult}
 */
function result(overrides = {}) {
  return {
    test: { file: "add.test.mjs", line: 1, name: "adds", path: [] },
    answers: {},
    canFail: { values: [0.99, 0.99, 0.98], mean: 0.99, spread: 0.01, state: "stable", unstable: false },
    asserts: { value: "behaviour", a: "behaviour", b: "behaviour", trust: true, agrees: true },
    runs: true,
    pairs: {},
    type: "unit",
    descriptive: {},
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
});

test("exitCode is 2 when a call failed, even beside a test that needs eyes", () => {
  const failed = result({ needsEyes: true, reasons: ["no answers (fetch failed)"], error: "fetch failed" });
  assert.equal(exitCode([result(), failed]), 2);
  assert.equal(exitCode([result({ needsEyes: true, reasons: ["x"] }), failed]), 2);
});

test("formatText names the escalated test and its reasons", () => {
  const text = formatText([result(), result({ test: { file: "bar.test.mjs", line: 3, name: "sane", path: [] }, score: { value: 0, label: "slop" }, needsEyes: true, reasons: ["can_fail unstable (spread 0.91)"] })], { ref: "origin/main...HEAD" });
  assert.match(text, /Audit of origin\/main\.\.\.HEAD/);
  assert.match(text, /slop/);
  assert.match(text, /Needs eyes:/);
  assert.match(text, /can_fail unstable/);
  assert.match(text, /Summary: 1 strong, 1 slop\. 0 unstable\. 1 needs eyes\./);
});

test("the json face emits the full record", () => {
  const json = JSON.parse(formatAudit({ results: [result()], ref: "HEAD", usage: { calls: 1, tokens: 5 } }, { format: "json" }));
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

test("pad does not truncate when the width is 0", () => {
  assert.equal(pad("adds", 0), "adds");
  assert.equal(pad("a longer name", 6), "a lon…");
});

test("formatAudit picks the face, and an empty change reads the same in every face", () => {
  const audit = { results: [result()], ref: "HEAD", model: "nimble", usage: { calls: 1, tokens: 5 } };
  assert.match(formatAudit(audit, { format: "text" }), /Audit of HEAD/);
  assert.match(formatAudit(audit, { format: "markdown" }), /## Test audit/);
  assert.match(formatAudit(audit, { format: "json" }), /"results"/);
  const empty = { results: [], ref: "HEAD", model: "nimble", usage: { calls: 0, tokens: 0 } };
  assert.equal(formatAudit(empty, { format: "text" }), "Test audit: no tests in the change.");
  assert.equal(formatAudit(empty, { format: "markdown" }), "Test audit: no tests in the change.");
  assert.deepEqual(JSON.parse(formatAudit(empty, { format: "json" })), { ref: "HEAD", model: "nimble", usage: { calls: 0, tokens: 0 }, results: [] });
});