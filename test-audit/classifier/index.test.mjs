// Unit tests for the battery and the verdict rules. Every answer is written by
// hand, so the escalation logic is tested without the model: the property that
// makes `classify` an injectable-ask function.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildState, classify } from "./index.mjs";
import { BATTERY, CHECKS } from "../checks/index.mjs";
import { verdictFrom } from "./verdict.mjs";
import { assertsAs, goodAnswers, noul } from "../test-fixtures.mjs";

/** @typedef {import("../types.d.ts").AuditTest} AuditTest */

/** @type {AuditTest} */
const TEST = { file: "add.test.mjs", line: 1, name: "add", path: [], scope: [], source: 'test("add", () => { expect(add(1, 1)).toBe(2); });', fixtures: [], imports: [], flags: [] };

test("every question is a yes/no question, so no option order can bias it", () => {
  for (const [key, question] of Object.entries(BATTERY)) assert.equal(question.type, "noul", key);
});

test("only an asserts question has yes as its finding; every twin is asked the plain way round", () => {
  for (const check of CHECKS) if (check.role !== "asserts") assert.deepEqual(check.negated ?? [], [], check.name);
});

test("buildState sends the test and the context, and no rubric", () => {
  const full = buildState(TEST, "the change", 10_000);
  assert.match(full, /^Test:\n/);
  assert.match(full, /expect\(add\(1, 1\)\)/);
  assert.match(full, /the change/);
  assert.doesNotMatch(full, /Rubric/);
});

test("buildState truncates a test longer than the cap", () => {
  const big = { ...TEST, source: `test("big", () => { ${"expect(x).toBe(1); ".repeat(200)}});` };
  assert.match(buildState(big, "", 600), /test truncated/);
});

test("a long test keeps its assertion, and the change context gives way", () => {
  const setup = Array.from({ length: 40 }, (_, i) => `  const v${i} = await setupThing${i}({ id: ${i}, name: "fixture-${i}" });`);
  const long = { ...TEST, source: `test("long", async () => {\n${setup.join("\n")}\n  expect(total).toBe(4200);\n});` };
  const state = buildState(long, "c".repeat(3000), 5000);
  assert.match(state, /toBe\(4200\)/);
  assert.equal(state.includes("test truncated"), false);
  assert.match(state, /context truncated/);
  assert.equal(state.length <= 5000 + "\n… [context truncated]".length, true);
});

test("buildState carries an enclosing describe head and the extractor's notes", () => {
  const inside = { ...TEST, scope: ['describe.skip("math", () => {'], flags: ["focus-in-file"] };
  const state = buildState(inside, "", 10_000);
  assert.match(state, /describe\.skip\(\\"math\\"/);
  assert.match(state, /focus-in-file/);
  assert.equal(buildState(TEST, "", 10_000).includes('"scope"'), false);
});

test("a clean test does not escalate, and its verdict is good", () => {
  const result = verdictFrom(TEST, goodAnswers());
  assert.equal(result.needsEyes, false);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.score.label, "good");
  assert.equal(result.canFail?.state, "stable");
  assert.equal(result.asserts, "behaviour");
  assert.equal(result.checks.can_fail.value, true);
});

test("a paraphrase spread above the band is instability, not a tie to break", () => {
  const result = verdictFrom(TEST, { ...goodAnswers(), can_fail_a: noul(0.92), can_fail_c: noul(0.1) });
  assert.equal(result.canFail?.state, "unstable");
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /can_fail unstable/);
});

test("a small spread stays stable but a middle one is borderline", () => {
  const stable = verdictFrom(TEST, { ...goodAnswers(), can_fail_c: noul(0.80) });
  assert.equal(stable.canFail?.state, "stable");
  assert.equal(stable.needsEyes, false);
  const borderline = verdictFrom(TEST, { ...goodAnswers(), can_fail_c: noul(0.65) });
  assert.equal(borderline.canFail?.state, "borderline");
  assert.equal(borderline.needsEyes, true);
});

test("an untrusted answer escalates rather than passing silently", () => {
  const result = verdictFrom(TEST, { ...goodAnswers(), can_fail_a: noul(0.99, 0.1) });
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /can_fail not fully answered/);
});

test("asserts that disagree escalate, and any non-behaviour assertion escalates", () => {
  // "Compares content" beside "only the shape" is a contradiction.
  const disagree = verdictFrom(TEST, { ...goodAnswers(), asserts_shape: noul(0.9) });
  assert.equal(disagree.asserts, undefined);
  assert.match(disagree.reasons.join(" "), /asserts unstable \(exact vs shape-only\)/);

  for (const kind of /** @type {const} */ (["inexact", "shape-only", "from-code", "interaction-only"])) {
    const result = verdictFrom(TEST, { ...goodAnswers(), ...assertsAs(kind) });
    assert.equal(result.needsEyes, true, kind);
    assert.match(result.reasons.join(" "), new RegExp(`asserts ${kind}`));
    assert.ok(result.flags.includes(kind));
  }
});

test("a test with no positive assertion escalates, and its verdict is weak", () => {
  const result = verdictFrom(TEST, { ...goodAnswers(), positive_a: noul(0.1), positive_b: noul(0.1) });
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /no positive assertion/);
  assert.equal(result.score.label, "weak");
});

test("the verdict is computed from the answers that carry it", () => {
  const level = (/** @type {Record<string, any>} */ answers) => verdictFrom(TEST, { ...goodAnswers(), ...answers }).score.label;
  assert.equal(level({ ...assertsAs("inexact") }), "weak");
  assert.equal(level({ ...assertsAs("from-code") }), "slop");
  assert.equal(level({ ...assertsAs("shape-only") }), "weak");
  assert.equal(level({ can_fail_a: noul(0.1), can_fail_c: noul(0.1) }), "slop");
  // Phrasings that disagree commit to nothing, so there is no verdict.
  assert.equal(level({ asserts_shape: noul(0.9) }), undefined);
});

test("a test the extractor marks as skipped, or a focus marker in its file, escalates", () => {
  for (const flag of ["skipped", "focus-in-file"]) {
    const result = verdictFrom({ ...TEST, flags: [flag] }, goodAnswers());
    assert.equal(result.checks.runs.value, false, flag);
    assert.match(result.reasons.join(" "), /does not run/);
  }
  assert.equal(verdictFrom(TEST, goodAnswers()).checks.runs.value, true);
});

test("an asserts answer on exactly 0.5 leaves no kind, and escalates", () => {
  const result = verdictFrom(TEST, { ...goodAnswers(), asserts_mock: noul(0.5) });
  assert.equal(result.asserts, undefined);
  assert.match(result.reasons.join(" "), /asserts not fully answered/);
});

test("descriptive gates report as flags without escalating", () => {
  const keys = CHECKS.filter((check) => check.role === "descriptive").flatMap((check) => Object.keys(check.questions));
  const off = Object.fromEntries(keys.map((key) => [key, noul(0.1)]));
  const result = verdictFrom(TEST, { ...goodAnswers(), ...off });
  assert.equal(result.needsEyes, false);
  for (const flag of ["conditional", "order-dependent", "non-deterministic", "manual", "state-leak"]) {
    assert.ok(result.flags.includes(flag), flag);
  }
});

test("cannot fail beside a behaviour assertion is a contradiction, and escalates", () => {
  // Each answer is stable, so only a rule across questions sees the conflict.
  const result = verdictFrom(TEST, { ...goodAnswers(), can_fail_a: noul(0.2), can_fail_c: noul(0.25) });
  assert.equal(result.canFail?.state, "stable");
  assert.equal(result.checks.can_fail.value, false);
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /can_fail contradicts asserts/);
});

test("a transport failure is an audit failure", () => {
  const result = verdictFrom(TEST, {}, { error: "systemone 503: busy" });
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /no answers/);
});

test("classify asks once with the state and the whole battery", async () => {
  /** @type {{ state: string, questions: Record<string, unknown> } | undefined} */
  let seen;
  /** @param {string} state @param {Record<string, unknown>} questions */
  const ask = async (state, questions) => {
    seen = { state, questions };
    return goodAnswers();
  };
  const result = await classify(TEST, { ask, changeContext: "the change" });
  assert.ok(seen);
  assert.match(seen.state, /add\.test\.mjs/);
  assert.match(seen.state, /the change/);
  assert.deepEqual(Object.keys(seen.questions), Object.keys(BATTERY));
  assert.equal(result.needsEyes, false);
});

test("answers without mass are accepted, so an Ollama response works", () => {
  // Ollama 0.35 reports no `mass`; only the fields the question needs are sent.
  const answers = Object.fromEntries(
    Object.entries(goodAnswers()).map(([key, answer]) => [key, "choice" in answer ? { choice: answer.choice } : { noul: answer.noul }]),
  );
  const result = verdictFrom(TEST, answers);
  assert.equal(result.canFail?.state, "stable");
  assert.equal(result.asserts, "behaviour");
  assert.equal(result.needsEyes, false);
});

test("the extractor's flags and the positive answer reach the result", () => {
  const result = verdictFrom({ ...TEST, flags: ["each"] }, goodAnswers());
  assert.ok(result.flags.includes("each"));
  assert.equal(result.checks.positive.value, true);
  assert.equal(result.needsEyes, false);
});

test("a twin that disagrees escalates, so one confident wrong answer cannot pass alone", () => {
  const result = verdictFrom(TEST, { ...goodAnswers(), positive_a: noul(0.92), positive_b: noul(0.1) });
  assert.equal(result.checks.positive.value, undefined);
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /positive unstable \(spread 0\.82\)/);
});

test("a twin with one phrasing unanswered escalates", () => {
  const answers = Object.fromEntries(Object.entries(goodAnswers()).filter(([key]) => key !== "positive_b"));
  const result = verdictFrom(TEST, answers);
  assert.equal(result.checks.positive.value, undefined);
  assert.match(result.reasons.join(" "), /positive not fully answered/);
});

test("each check yields one result, and the reasons come in role order", () => {
  const answers = { ...goodAnswers(), can_fail_c: noul(0.4), ...assertsAs("inexact") };
  const result = verdictFrom({ ...TEST, flags: ["skipped"] }, answers, { error: "partial" });
  assert.deepEqual(Object.keys(result.checks), CHECKS.map((check) => check.name));
  assert.deepEqual(result.reasons, ["no answers (partial)", "can_fail unstable (spread 0.59)", "does not run, or narrows the run", "asserts inexact"]);
  assert.deepEqual(result.checks.runs, { value: false, reasons: ["does not run, or narrows the run"], flags: [] });
  assert.deepEqual(result.checks.asserts.flags, ["inexact"]);
});

test("an exact tie escalates instead of passing", () => {
  const gate = verdictFrom(TEST, { ...goodAnswers(), positive_a: noul(0.5), positive_b: noul(0.5) });
  assert.equal(gate.checks.positive.value, undefined);
  assert.match(gate.reasons.join(" "), /positive undecided/);
});

test("an asserts answer near 0.5 commits to no kind, and escalates", () => {
  const result = verdictFrom(TEST, { ...goodAnswers(), asserts_exact: noul(0.6) });
  assert.equal(result.asserts, undefined);
  assert.match(result.reasons.join(" "), /asserts unstable \(unsure exact 0\.60\)/);
});

test("an unsure answer that does not change the kind is no doubt", () => {
  // A literal expected value: whether it is "the same code" no longer matters.
  const result = verdictFrom(TEST, { ...goodAnswers(), asserts_same: noul(0.35) });
  assert.equal(result.asserts, "behaviour");
  assert.equal(result.needsEyes, false);
  // Read from code, and unsure whether it is the same code: that decides the kind.
  const read = verdictFrom(TEST, { ...goodAnswers(), asserts_written: noul(0.05), asserts_same: noul(0.35) });
  assert.match(read.reasons.join(" "), /asserts unstable \(unsure same 0\.35\)/);
});
