// Unit tests for the calibration faces. Each entry is built by hand: the answers
// go through the real verdict rules and the real judge, so the benchmark layout is
// tested without a live endpoint.

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBenchmark, formatMatrix, formatSingle } from "./format.mjs";
import { judge } from "./judge.mjs";
import { BATTERY, DESCRIPTIVE_KEYS } from "../checks/index.mjs";
import { verdictFrom } from "../classifier/verdict.mjs";

/** @typedef {import("../types.d.ts").AuditAnswer} AuditAnswer */
/** @typedef {import("../types.d.ts").AuditTest} AuditTest */
/** @typedef {import("../types.d.ts").CalibrationLabel} CalibrationLabel */
/** @typedef {import("../types.d.ts").CalibrationRow} CalibrationRow */

/** @param {number} value @returns {AuditAnswer} */
const noul = (value) => ({ type: "noul", probabilities: {}, confidence: 0.9, mass: 0.99, noul: value });
/** @param {string} value @param {number} probability @returns {AuditAnswer} */
const choice = (value, probability) => ({ type: "choice", probabilities: { [value]: probability }, confidence: 0.9, mass: 0.99, choice: value });
/** @param {number} value @returns {AuditAnswer} */
const score = (value) => ({ type: "score", probabilities: {}, confidence: 0.9, mass: 0.99, score: value });

/** A battery that passes: the test can fail, asserts behaviour, and scores strong. */
function goodAnswers() {
  /** @type {Record<string, AuditAnswer>} */
  const answers = {
    can_fail_a: noul(0.99),
    can_fail_b: noul(0.02),
    can_fail_c: noul(0.97),
    asserts_a: choice("behaviour", 0.91),
    asserts_b: choice("behaviour", 0.88),
    positive_a: noul(0.96),
    positive_b: noul(0.04),
    runs_a: noul(0.99),
    runs_b: noul(0.01),
    type: choice("unit", 0.8),
    verdict: score(2.9),
  };
  for (const key of DESCRIPTIVE_KEYS) answers[key] = noul(0.95);
  return answers;
}

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
  { file: "cases/good-add.case.mjs", test: "adds two numbers", defect: "clean", canFail: true, mustEscalate: false, note: "A real guard.", group: "good", sources: [{ name: "Beck, Test Desiderata", url: "https://example.org/desiderata" }] },
  'test("adds two numbers", () => {\n  expect(add(1, 2)).toBe(3);\n})',
  goodAnswers(),
);

/** A tautology that the endpoint calls a strong guard: a silent pass. */
const SILENT = row(
  { file: "cases/tautology.case.mjs", test: "the world is sane", defect: "tautology", canFail: false, mustEscalate: true },
  'test("the world is sane", () => {\n  expect(true).toBe(true);\n})',
  goodAnswers(),
);

/** A shape-only test that escalates, with an unstable can_fail, a twin pair that says no, two smells, and its code under test. */
const SHAPE = row(
  { file: "cases/shape.case.mjs", test: "returns a list", defect: "shape-only", canFail: true, mustEscalate: true, code: "cases/shape.code.mjs" },
  "test(\"returns a list\", () => {\n  // ```\n  expect(Array.isArray(list())).toBe(true);\n})",
  { ...goodAnswers(), can_fail_a: noul(0.9), can_fail_b: noul(0.8), asserts_a: choice("shape-only", 0.7), asserts_b: choice("shape-only", 0.6), named: noul(0.1), reads_output: noul(0.2), positive_a: noul(0.2), positive_b: noul(0.8), verdict: score(0.2) },
  "export function list() {\n  return [1];\n}\n",
);

/** @param {CalibrationRow[]} rows @param {string[]} [missing] */
function entry(rows, missing) {
  return { target: { url: "http://127.0.0.1:11434", model: "nimble" }, rows, verdict: judge(rows, { canFailAgreement: 0.9 }), usage: { calls: rows.length, tokens: 1000 }, missing };
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
  assert.ok(text.includes("| # | Test | Known defect | Expected | Result | Status |"));
  assert.ok(text.includes("| 1 | [`the world is sane`](#case-1) | tautology | escalate | strong, passes | **SILENT pass** |"));
  assert.ok(text.includes("| 2 | [`adds two numbers`](#case-2) | clean | pass | strong, passes | OK |"));
  assert.ok(text.includes("| 3 | [`returns a list`](#case-3) | shape-only | escalate | slop, needs eyes | OK |"));
});

test("a case that is not OK is an open details block, and an OK case is closed", () => {
  const text = formatBenchmark([entry([CLEAN, SILENT])]);
  assert.ok(text.includes('<details open><summary><a id="case-1"></a>1. <code>the world is sane</code> · tautology · <b>SILENT pass</b></summary>\n\n```js\n'));
  assert.ok(text.includes('<details><summary><a id="case-2"></a>2. <code>adds two numbers</code> · clean · OK</summary>\n\n```js\n'));
  assert.ok(caseBlock(text, 1).includes("**WRONG can_fail:** label no, tool 0.98."));
});

test("a case shows its source, its label in plain words, and what decided it", () => {
  const block = caseBlock(formatBenchmark([entry([CLEAN])]), 1);
  assert.ok(block.includes('```js\ntest("adds two numbers", () => {\n  expect(add(1, 2)).toBe(3);\n})\n```\n- **Known defect:** none, a clean test.'));
  assert.ok(block.includes("**Expected:** pass, `can_fail` yes. Note: A real guard. Case file [`cases/good-add.case.mjs`](calibration/cases/good-add.case.mjs), line 2."));
  assert.ok(block.includes("Sources: [Beck, Test Desiderata](https://example.org/desiderata)."));
  assert.ok(block.includes("- **What decided it:** strong, passes.\n  - No escalation: `can_fail_a` yes (0.99) · `can_fail_b` no (0.02) · `can_fail_c` yes (0.97) → can_fail: 0.98, spread 0.02 (stable). Label yes: match."));
  assert.ok(block.includes("`asserts_a` behaviour (0.91) · `asserts_b` behaviour (0.88) → asserts: behaviour."));
  assert.ok(block.includes("`verdict` strong (2.90)."));
  assert.ok(!block.includes("Code under test"), "no code block without code");
});

test("an escalated case ties each reason to the answers behind it, a twin pair with each phrasing", () => {
  const block = caseBlock(formatBenchmark([entry([SHAPE])]), 1);
  assert.ok(block.includes("````js\n"), "the fence is longer than the backtick run in the source");
  assert.match(block, /\n {2}- `can_fail_a` yes \(0\.90\) · `can_fail_b` yes \(0\.80\) · `can_fail_c` yes \(0\.97\) → can_fail: 0\.\d\d, spread 0\.\d\d \(\w+\)\. \*\*Escalates:\*\* can_fail \w+ \(spread 0\.\d\d\)\. Label yes: not scored\.\n/);
  assert.ok(block.includes("\n  - `asserts_a` shape-only (0.70) · `asserts_b` shape-only (0.60) → asserts: shape-only. **Escalates:** asserts shape-only.\n"));
  assert.ok(block.includes("\n  - `positive_a` no (0.20) · `positive_b` yes (0.80) → positive: no. **Escalates:** no positive assertion.\n"));
  assert.ok(block.includes("\n  - `verdict` slop (0.20). **Escalates:** verdict slop.\n"));
  assert.ok(block.includes("\n  - No escalation: `runs_a` yes (0.99) · `runs_b` no (0.01) → runs: yes.\n"));
});

test("the descriptive answers fit in one line", () => {
  const block = caseBlock(formatBenchmark([entry([SHAPE])]), 1);
  assert.ok(block.includes("\n- **Descriptive:** 16 clean · smells: `named` (vague-name), `reads_output` (asserts-input) · unanswered: none · `type` unit (0.80).\n"));
});

test("a case with code under test shows it in its own block", () => {
  const block = caseBlock(formatBenchmark([entry([SHAPE])]), 1);
  assert.ok(block.includes("\n````\nCode under test, [`cases/shape.code.mjs`](calibration/cases/shape.code.mjs):\n\n```js\nexport function list() {\n  return [1];\n}\n```\n- **Known defect:** shape-only."));
});

test("a record without raw answers shows its values, and 'not recorded' for what it lacks", () => {
  const result = { ...CLEAN.result, answers: {}, positive: undefined, pairs: {}, type: undefined };
  const rebuilt = { ...CLEAN, result: /** @type {import("../types.d.ts").AuditResult} */ (result) };
  const block = caseBlock(formatBenchmark([entry([rebuilt], ["can_fail_a", "can_fail_b", "can_fail_c", "runs_a", "runs_b", "positive_a", "positive_b", "type"])]), 1);
  assert.ok(block.includes("`can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.98, spread 0.02 (stable)."));
  assert.ok(block.includes("`asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour."));
  assert.ok(block.includes("`runs_a` · `runs_b` not recorded → runs: yes."));
  assert.ok(block.includes("`positive_a` · `positive_b` not recorded → positive: not recorded."));
  assert.ok(block.includes("· `type` not recorded."));
  const partial = caseBlock(formatBenchmark([entry([rebuilt], ["can_fail_a"])]), 1);
  assert.ok(partial.includes("`can_fail_a` not recorded · `can_fail_b` unanswered · `can_fail_c` unanswered → can_fail:"));
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
  assert.match(single, /the world is sane\s+tautology\s+no\s+0\.98\s+stable\s+strong\s+-\s+SILENT/);
  assert.match(single, /Acceptance: FAIL/);
  const matrix = formatMatrix([entry([CLEAN, SILENT]), entry([CLEAN, SILENT])]);
  assert.match(matrix, /the world is sane\s+tautology\s+S\s+S/);
});
