// Unit tests for the calibration faces. Each entry is built by hand: the answers
// go through the real verdict rules and the real judge, so the benchmark layout is
// tested without a live endpoint.

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBenchmark, formatMatrix, formatSingle } from "./format.mjs";
import { judge } from "./judge.mjs";
import { BATTERY } from "../checks/index.mjs";
import { verdictFrom } from "../classifier/verdict.mjs";
import { assertsAs, goodAnswers, noul } from "../test-fixtures.mjs";

/** @typedef {import("../types.d.ts").AuditTest} AuditTest */
/** @typedef {import("../types.d.ts").CalibrationLabel} CalibrationLabel */
/** @typedef {import("../types.d.ts").CalibrationRow} CalibrationRow */
/** @typedef {import("../types.d.ts").AuditAnswer} AuditAnswer */

/** @param {string} name @param {string} source @returns {AuditTest} */
function auditTest(name, source) {
  return { file: "example.test.mjs", line: 2, name, path: [], scope: [], source, fixtures: [], imports: [], flags: [] };
}

/**
 * One labelled row: the prepared test, the code under test if any, and the
 * result the verdict rules give for the answers.
 * @param {CalibrationLabel} label @param {string} source @param {Record<string, AuditAnswer>} answers @param {string} [code]
 * @returns {CalibrationRow}
 */
function row(label, source, answers, code) {
  const test = auditTest(label.test, source);
  return { label, test, code, result: verdictFrom(test, answers) };
}

const CLEAN = row(
  { check: "verdict", file: "checks/verdict/cases/good-add/case.mjs", test: "adds two numbers", defect: "clean", canFail: true, mustEscalate: false, note: "A real guard.", sources: [{ name: "Beck, Test Desiderata", url: "https://example.org/desiderata" }] },
  'test("adds two numbers", () => {\n  expect(add(1, 2)).toBe(3);\n})',
  goodAnswers(),
);

/** A tautology that the endpoint calls a good guard: a silent pass. */
const SILENT = row(
  { check: "can-fail", file: "checks/can-fail/cases/tautology/case.mjs", test: "the world is sane", defect: "tautology", canFail: false, mustEscalate: true },
  'test("the world is sane", () => {\n  expect(true).toBe(true);\n})',
  goodAnswers(),
);

/** A shape-only test that escalates, with an unstable can_fail, a twin pair that says no, two smells, and its code under test. */
const SHAPE = row(
  { check: "asserts", file: "checks/asserts/cases/shape/case.mjs", test: "returns a list", defect: "shape-only", canFail: true, mustEscalate: true, code: "checks/asserts/cases/shape/code.mjs" },
  "test(\"returns a list\", () => {\n  // ```\n  expect(Array.isArray(list())).toBe(true);\n})",
  { ...goodAnswers(), can_fail_a: noul(0.9), can_fail_c: noul(0.3), ...assertsAs("shape-only"), deterministic: noul(0.1), restores: noul(0.2), positive_a: noul(0.2), positive_b: noul(0.2) },
  "export function list() {\n  return [1];\n}\n",
);

/** @param {CalibrationRow[]} rows */
function entry(rows) {
  return { target: { url: "http://127.0.0.1:11434", model: "nimble" }, rows, verdict: judge(rows), usage: { calls: rows.length, tokens: 1000 } };
}

/** The `<details>` block of one case, by its number. @param {string} text @param {number} number */
function caseBlock(text, number) {
  const start = text.indexOf(`<a id="case-${number}"></a>`);
  assert.ok(start >= 0, `no case ${number}`);
  return text.slice(start, text.indexOf("</details>", start));
}

test("the benchmark starts with the summary, the families, and the links to the cases that are not OK", () => {
  const text = formatBenchmark([entry([CLEAN, SILENT, SHAPE])], { preamble: ["Date: 2026-10-06."] });
  assert.ok(text.startsWith("# test-audit benchmark\n\nDate: 2026-10-06.\n"));
  assert.match(text, /\| Silent passes \| 1 \| Defect cases that did not escalate\. Must be 0\. \|/);
  assert.match(text, /\| can_fail agreement \| 1 of 2 \(50%\) \| .* Must be 90% or more\. \|/);
  assert.match(text, /\| Acceptance \| \*\*FAIL\*\* \|/);
  assert.match(text, /\| clean \| 1 \| 0 \| pass \| yes \|/);
  assert.match(text, /\| tautology \| 1 \| 0 \| escalate \| \*\*no\*\*: 1 SILENT pass \|/);
  assert.match(text, /\*\*Not OK:\*\* \[1\. `the world is sane`\]\(#case-1\) SILENT pass\./);
  const order = ["## Summary: nimble", "## Cases at a glance: nimble", "## Case details: nimble", "## Legend", "### Questions"].map((heading) => text.indexOf(heading));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "the sections come in this order");
  assert.ok(!order.includes(-1), "each section is present");
});

test("the glance table has one row for each case, the cases that are not OK first, each linked to its details", () => {
  const text = formatBenchmark([entry([CLEAN, SHAPE, SILENT])]);
  assert.ok(text.includes("| # | Test | Check | Known defect | Expected | Result | Status |"));
  assert.ok(text.includes("| 1 | [`the world is sane`](#case-1) | [`can-fail`](checks/can-fail/check.mjs) | tautology | escalate | good, passes | **SILENT pass** |"));
  assert.ok(text.includes("| 2 | [`adds two numbers`](#case-2) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |"));
  assert.ok(text.includes("| 3 | [`returns a list`](#case-3) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | weak, needs eyes | OK |"));
});

test("a case that is not OK is an open details block, and an OK case is closed", () => {
  const text = formatBenchmark([entry([CLEAN, SILENT])]);
  assert.ok(text.includes('<details open><summary><a id="case-1"></a>1. <code>the world is sane</code> · tautology · <b>SILENT pass</b></summary>\n\n```js\n'));
  assert.ok(text.includes('<details><summary><a id="case-2"></a>2. <code>adds two numbers</code> · clean · OK</summary>\n\n```js\n'));
  assert.ok(caseBlock(text, 1).includes("**WRONG can_fail:** label no, tool 0.99."));
});

test("a case shows its source, its label in plain words, and what decided it", () => {
  const block = caseBlock(formatBenchmark([entry([CLEAN])]), 1);
  assert.ok(block.includes('```js\ntest("adds two numbers", () => {\n  expect(add(1, 2)).toBe(3);\n})\n```\n- **Known defect:** none, a clean test.'));
  assert.ok(block.includes("- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs)."));
  assert.ok(block.includes("**Expected:** pass, `can_fail` yes. Note: A real guard. Case file [`checks/verdict/cases/good-add/case.mjs`](checks/verdict/cases/good-add/case.mjs), line 2."));
  assert.ok(block.includes("Sources: [Beck, Test Desiderata](https://example.org/desiderata)."));
  assert.ok(block.includes("- **What decided it:** good, passes.\n  - No escalation: `can_fail_a` yes (0.99) · `can_fail_c` yes (0.99) → can_fail: 0.99, spread 0.00 (stable). Label yes: match."));
  assert.ok(block.includes("`asserts_exact` yes (0.99) · `asserts_written` yes (0.99) · `asserts_same` no (0.01) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: behaviour."));
  assert.ok(!block.includes("Code under test"), "no code block without code");
});

test("an escalated case ties each reason to the answers behind it, a twin pair with each phrasing", () => {
  const block = caseBlock(formatBenchmark([entry([SHAPE])]), 1);
  assert.ok(block.includes("````js\n"), "the fence is longer than the backtick run in the source");
  assert.match(block, /\n {2}- `can_fail_a` yes \(0\.90\) · `can_fail_c` no \(0\.30\) → can_fail: 0\.\d\d, spread 0\.\d\d \(\w+\)\. \*\*Escalates:\*\* can_fail \w+ \(spread 0\.\d\d\)\. Label yes: not scored\.\n/);
  assert.ok(block.includes("→ asserts: shape-only. **Escalates:** asserts shape-only.\n"));
  assert.ok(block.includes("\n  - `positive_a` no (0.20) · `positive_b` no (0.20) → positive: no. **Escalates:** no positive assertion.\n"));
  assert.ok(block.includes("runs: yes, from the extractor's flags."));
});

test("the descriptive answers fit in one line", () => {
  const block = caseBlock(formatBenchmark([entry([SHAPE])]), 1);
  assert.ok(block.includes("\n- **Descriptive:** 4 clean · smells: `deterministic` (non-deterministic), `restores` (state-leak) · unanswered: none.\n"));
});

test("a case with code under test shows it in its own block", () => {
  const block = caseBlock(formatBenchmark([entry([SHAPE])]), 1);
  assert.ok(block.includes("\n````\nCode under test, [`checks/asserts/cases/shape/code.mjs`](checks/asserts/cases/shape/code.mjs):\n\n```js\nexport function list() {\n  return [1];\n}\n```\n- **Known defect:** shape-only."));
});

test("a case the endpoint never answered shows the error, not the answers", () => {
  const failed = { ...CLEAN, result: verdictFrom(CLEAN.test ?? auditTest("x", ""), {}, { error: "fetch failed" }) };
  const block = caseBlock(formatBenchmark([entry([failed])]), 1);
  assert.ok(block.includes("- **Status:** NO ANSWER, the endpoint gave no trusted answer. Acceptance fails. Error: fetch failed."));
  assert.ok(!block.includes("What decided it"));
});

test("the legend lists each question of the battery once", () => {
  const text = formatBenchmark([entry([CLEAN])]);
  const questions = text.slice(text.indexOf("### Questions"));
  for (const [key, question] of Object.entries(BATTERY)) assert.ok(questions.includes(`| \`${key}\` | ${question.instructions} |`), `no row for ${key}`);
});

test("a test name is escaped in the summary line", () => {
  const odd = { ...CLEAN, label: { ...CLEAN.label, test: 'keeps <b> & "quotes"' } };
  assert.ok(formatBenchmark([entry([odd])]).includes("<code>keeps &lt;b&gt; &amp; &quot;quotes&quot;</code>"));
});

test("several targets get their own summary and their own anchors", () => {
  const text = formatBenchmark([entry([CLEAN, SILENT]), entry([CLEAN, SILENT])]);
  assert.ok(text.includes("](#t2-case-1) SILENT pass"));
  assert.ok(text.includes('<a id="t2-case-1"></a>'));
  assert.ok(text.indexOf("## Summary: nimble", text.indexOf("## Summary: nimble") + 1) < text.indexOf("## Cases at a glance"), "the summaries come first");
  assert.equal(text.split("## Legend").length, 2, "one legend");
});

test("the single and matrix views still render", () => {
  const single = formatSingle(entry([CLEAN, SILENT]));
  assert.match(single, /the world is sane\s+tautology\s+no\s+0\.99\s+stable\s+good\s+-\s+SILENT/);
  assert.match(single, /Acceptance: FAIL/);
  const matrix = formatMatrix([entry([CLEAN, SILENT]), entry([CLEAN, SILENT])]);
  assert.match(matrix, /the world is sane\s+tautology\s+S\s+S/);
});
