// Unit tests for the calibration faces. Each entry is built by hand: the answers
// go through the real verdict rules and the real judge, so the benchmark layout is
// tested without a live endpoint.

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBenchmark, formatMatrix, formatSingle } from "./format.mjs";
import { judge } from "./judge.mjs";
import { BATTERY, DESCRIPTIVE_KEYS } from "../classifier/battery.mjs";
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
    positive: noul(0.96),
    runs: noul(0.99),
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
 * One labelled row: the prepared test and the result the verdict rules give for
 * the answers.
 * @param {CalibrationLabel} label @param {string} source @param {Record<string, AuditAnswer>} answers
 * @returns {CalibrationRow}
 */
function row(label, source, answers) {
  const test = auditTest(label.test, source);
  return { label, test, result: verdictFrom(test, answers) };
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

/** A shape-only test that escalates, with an unstable can_fail and a smell. */
const SHAPE = row(
  { file: "cases/shape.case.mjs", test: "returns a list", defect: "shape-only", canFail: true, mustEscalate: true },
  "test(\"returns a list\", () => {\n  // ```\n  expect(Array.isArray(list())).toBe(true);\n})",
  { ...goodAnswers(), can_fail_a: noul(0.9), can_fail_b: noul(0.8), asserts_a: choice("shape-only", 0.7), asserts_b: choice("shape-only", 0.6), named: noul(0.1), positive: noul(0.2), verdict: score(0.2) },
);

/** @param {CalibrationRow[]} rows @param {string[]} [missing] */
function entry(rows, missing) {
  return { target: { url: "http://127.0.0.1:11434", model: "nimble" }, rows, verdict: judge(rows, { canFailAgreement: 0.9 }), usage: { calls: rows.length, tokens: 1000 }, missing };
}

test("the benchmark starts with the summary, the families, and the index of the cases that are not OK", () => {
  const text = formatBenchmark([entry([CLEAN, SILENT, SHAPE])], { preamble: ["Date: 2026-10-06."] });
  assert.ok(text.startsWith("# test-audit benchmark\n\nDate: 2026-10-06.\n"));
  assert.match(text, /\| Silent passes \| 1 \| Defect cases that did not escalate\. Must be 0\. \|/);
  assert.match(text, /\| can_fail agreement \| 1 of 2 \(50%\) \| .* Must be 90% or more\. \|/);
  assert.match(text, /\| Acceptance \| \*\*FAIL\*\* \|/);
  assert.match(text, /\| clean \| 1 \| 0 \| pass \| yes \|/);
  assert.match(text, /\| tautology \| 1 \| 0 \| escalate \| \*\*no\*\*: 1 SILENT pass \|/);
  assert.match(text, /\*\*Not OK:\*\* \[3\. `the world is sane`\]\(#case-3\) SILENT pass\./);
  assert.ok(text.indexOf("## Legend") < text.indexOf("## Cases: nimble"));
  assert.ok(text.includes('<a id="case-3"></a>\n\n### 3. `the world is sane`: SILENT pass'));
});

test("a case shows its source, its label in plain words, every question, and the outcome", () => {
  const text = formatBenchmark([entry([CLEAN])]);
  const section = text.slice(text.indexOf("### 1."));
  assert.ok(section.includes("```js\ntest(\"adds two numbers\", () => {\n  expect(add(1, 2)).toBe(3);\n})\n```"));
  assert.ok(section.includes("**Known defect: none.** It is a clean test. The tool should pass it, with no escalation. `can_fail` should be yes. Note: A real guard."));
  assert.ok(section.includes("Sources: [Beck, Test Desiderata](https://example.org/desiderata)."));
  for (const key of Object.keys(BATTERY)) assert.ok(section.includes(`| \`${key}\` |`), `no row for ${key}`);
  assert.ok(section.indexOf("| `verdict` |") < section.indexOf("**Descriptive questions**"), "the verdict-carrying questions come first");
  assert.ok(section.includes("| `can_fail_b` | yes: it passes even when the behaviour is broken | no (0.02) | as expected |"));
  assert.ok(section.includes("| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour (0.91) | - |"));
  assert.ok(section.includes("| `verdict` | scale: slop, weak, good, strong | strong (2.90) | - |"));
  assert.ok(section.includes("| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.98, spread 0.02 (stable) | matches the label |"));
  assert.ok(section.includes("- Needs eyes: **no**."));
  assert.ok(section.includes("- Status: **OK**, the outcome matches the label."));
});

test("an escalated case ties each reason and flag to its question", () => {
  const text = formatBenchmark([entry([SHAPE])]);
  assert.ok(text.includes("````js\n"), "the fence is longer than the backtick run in the source");
  assert.match(text, /\| \*can_fail\* \| .* \| mean 0\.\d\d!, spread 0\.\d\d \(\w+\) \| escalates: can_fail \w+ \(spread 0\.\d\d\) \|/);
  assert.ok(text.includes("| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |"));
  assert.ok(text.includes("| `positive` | yes: it asserts the positive case | no (0.20) | escalates: no positive assertion |"));
  assert.ok(text.includes("| `named` | yes: the name states the behaviour and the expected result | no (0.10) | flag `vague-name` |"));
  assert.ok(text.includes("| `verdict` | scale: slop, weak, good, strong | slop (0.20) | escalates: verdict slop |"));
  assert.match(text, /- Needs eyes: \*\*yes\*\*\. Reasons: .*no positive assertion; asserts shape-only; verdict slop\./);
});

test("a record without raw answers shows its values, and 'not recorded' for what it lacks", () => {
  const result = { ...CLEAN.result, answers: {}, positive: undefined, type: undefined };
  const rebuilt = { ...CLEAN, result: /** @type {import("../types.d.ts").AuditResult} */ (result) };
  const text = formatBenchmark([entry([rebuilt], ["can_fail_a", "positive", "type"])]);
  assert.ok(text.includes("| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |"));
  assert.ok(text.includes("| `positive` | yes: it asserts the positive case | not recorded | - |"));
  assert.ok(text.includes("| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |"));
  assert.ok(text.includes("| `runs` | yes: it runs | yes | - |"));
  assert.ok(text.includes("| `can_fail_b` | yes: it passes even when the behaviour is broken | unanswered | - |"));
});

test("several targets get their own summary and their own anchors", () => {
  const text = formatBenchmark([entry([CLEAN, SILENT]), entry([CLEAN, SILENT])]);
  assert.ok(text.includes("](#t2-case-2) SILENT pass"));
  assert.ok(text.includes('<a id="t2-case-2"></a>'));
  assert.equal(text.split("## Legend").length, 2, "one legend");
});

test("the single and matrix views still render", () => {
  const single = formatSingle(entry([CLEAN, SILENT]));
  assert.match(single, /the world is sane\s+tautology\s+no\s+0\.98\s+stable\s+strong\s+-\s+SILENT/);
  assert.match(single, /Acceptance: FAIL/);
  const matrix = formatMatrix([entry([CLEAN, SILENT]), entry([CLEAN, SILENT])]);
  assert.match(matrix, /the world is sane\s+tautology\s+S\s+S/);
});
