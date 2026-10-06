// Unit tests for the battery and the verdict rules. Every answer is written by
// hand, so the escalation logic is tested without the model: the property that
// makes `classify` an injectable-ask function.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildState, classify } from "./index.mjs";
import { BATTERY, CHECKS, RUBRIC } from "../checks/index.mjs";
import { verdictFrom } from "./verdict.mjs";
import { choice, goodAnswers, noul, score } from "../test-fixtures.mjs";

/** @typedef {import("../types.d.ts").AuditTest} AuditTest */

/** @type {AuditTest} */
const TEST = { file: "add.test.mjs", line: 1, name: "add", path: [], scope: [], source: 'test("add", () => { expect(add(1, 1)).toBe(2); });', fixtures: [], imports: [], flags: [] };

test("the second asserts phrasing lists the kinds in reverse order", () => {
  assert.deepEqual(Object.keys(BATTERY.asserts_b.criteria), [...Object.keys(BATTERY.asserts_a.criteria)].reverse());
});

test("buildState sends the rubric, the test, and the context", () => {
  const full = buildState(TEST, "the change", 10_000);
  assert.match(full, /Rubric for judging a test/);
  assert.match(full, /expect\(add\(1, 1\)\)/);
  assert.match(full, /the change/);
});

test("buildState keeps the rubric and truncates the test under pressure", () => {
  const big = { ...TEST, source: `test("big", () => { ${"expect(x).toBe(1); ".repeat(200)}});` };
  const capped = buildState(big, "", RUBRIC.length + 300);
  assert.match(capped, /Rubric for judging a test/);
  assert.match(capped, /test truncated/);
});

test("a long test keeps its assertion, and the change context gives way", () => {
  const setup = Array.from({ length: 40 }, (_, i) => `  const v${i} = await setupThing${i}({ id: ${i}, name: "fixture-${i}" });`);
  const long = { ...TEST, source: `test("long", async () => {\n${setup.join("\n")}\n  expect(total).toBe(4200);\n});` };
  const state = buildState(long, "c".repeat(3000), 8000);
  assert.match(state, /toBe\(4200\)/);
  assert.equal(state.includes("test truncated"), false);
  assert.match(state, /context truncated/);
  assert.equal(state.length <= 8000 + "\n… [context truncated]".length, true);
});

test("buildState carries an enclosing describe head and the extractor's notes", () => {
  const inside = { ...TEST, scope: ['describe.skip("math", () => {'], flags: ["focus-in-file"] };
  const state = buildState(inside, "", 10_000);
  assert.match(state, /describe\.skip\(\\"math\\"/);
  assert.match(state, /focus-in-file/);
  assert.equal(buildState(TEST, "", 10_000).includes('"scope"'), false);
});

test("a clean test does not escalate", () => {
  const result = verdictFrom(TEST, goodAnswers());
  assert.equal(result.needsEyes, false);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.score.label, "strong");
  assert.equal(result.canFail?.state, "stable");
  assert.equal(result.asserts, "behaviour");
  assert.equal(result.checks.can_fail.value, true);
});

test("a paraphrase spread above the band is instability, not a tie to break", () => {
  // The tautology the live probe missed: one phrasing says yes, its twins say no.
  const result = verdictFrom(TEST, { ...goodAnswers(), can_fail_a: noul(0.92), can_fail_b: noul(0.99), can_fail_c: noul(0.88) });
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
  const disagree = verdictFrom(TEST, { ...goodAnswers(), asserts_b: choice("shape-only") });
  assert.equal(disagree.asserts, undefined);
  assert.equal(disagree.checks.asserts.group?.state, "unstable");
  assert.match(disagree.reasons.join(" "), /asserts unstable/);

  for (const kind of ["nothing", "shape-only", "hardcoded-data", "interaction-only"]) {
    const result = verdictFrom(TEST, { ...goodAnswers(), asserts_a: choice(kind), asserts_b: choice(kind) });
    assert.equal(result.needsEyes, true, kind);
    assert.match(result.reasons.join(" "), new RegExp(`asserts ${kind}`));
    assert.ok(result.flags.includes(kind));
  }
});

test("a test with no positive assertion escalates", () => {
  const result = verdictFrom(TEST, { ...goodAnswers(), positive_a: noul(0.1), positive_b: noul(0.9) });
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /no positive assertion/);
});

test("a weak or slop verdict escalates", () => {
  assert.match(verdictFrom(TEST, { ...goodAnswers(), verdict: score(0) }).reasons.join(" "), /verdict slop/);
  assert.match(verdictFrom(TEST, { ...goodAnswers(), verdict: score(1) }).reasons.join(" "), /verdict weak/);
  assert.match(verdictFrom(TEST, { ...goodAnswers(), verdict: noul(0.5) }).reasons.join(" "), /verdict unclassified/);
});

test("a score between levels rounds to the nearest level", () => {
  const result = verdictFrom(TEST, { ...goodAnswers(), verdict: score(2.25) });
  assert.equal(result.score.label, "good");
  assert.equal(result.needsEyes, false);
  const low = verdictFrom(TEST, { ...goodAnswers(), verdict: score(0.4) });
  assert.equal(low.score.label, "slop");
  assert.equal(low.needsEyes, true);
});

test("a test that does not run escalates", () => {
  const result = verdictFrom(TEST, { ...goodAnswers(), runs_a: noul(0.1), runs_b: noul(0.9) });
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /does not run/);
});

test("descriptive gates report as flags without escalating", () => {
  const keys = CHECKS.filter((check) => check.role === "descriptive").flatMap((check) => Object.keys(check.questions));
  const off = Object.fromEntries(keys.map((key) => [key, noul(0.1)]));
  const result = verdictFrom(TEST, { ...goodAnswers(), ...off });
  assert.equal(result.needsEyes, false);
  for (const flag of ["implementation-coupled", "conditional", "order-dependent", "uncontrolled-resource", "weak-assert", "vague-name", "non-deterministic", "eager", "name-mismatch", "structure-dependent", "silent-failure", "general-fixture", "slow", "obscure", "magic-number", "asserts-input", "manual", "state-leak"]) {
    assert.ok(result.flags.includes(flag), flag);
  }
});

test("a good verdict beside a stable cannot-fail answer escalates", () => {
  // The three phrasings agree the test cannot fail, yet the verdict says strong.
  const result = verdictFrom(TEST, { ...goodAnswers(), can_fail_a: noul(0.2), can_fail_b: noul(0.8), can_fail_c: noul(0.25) });
  assert.equal(result.canFail?.state, "stable");
  assert.equal(result.checks.can_fail.value, false);
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /can_fail contradicts the verdict/);
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
  const answers = {
    can_fail_a: { noul: 0.99 },
    can_fail_b: { noul: 0.01 },
    can_fail_c: { noul: 0.98 },
    asserts_a: { choice: "behaviour" },
    asserts_b: { choice: "behaviour" },
    positive_a: { noul: 0.99 },
    positive_b: { noul: 0.01 },
    runs_a: { noul: 0.99 },
    runs_b: { noul: 0.01 },
    type: { choice: "unit" },
    deterministic: { noul: 0.99 },
    one_thing: { noul: 0.99 },
    name_matches: { noul: 0.99 },
    verdict: { score: 3 },
  };
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
  const result = verdictFrom(TEST, { ...goodAnswers(), positive_a: noul(0.92), positive_b: noul(0.9) });
  assert.equal(result.checks.positive.value, undefined);
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /positive unstable \(spread 0\.82\)/);
});

test("a twin with one phrasing unanswered escalates", () => {
  const answers = Object.fromEntries(Object.entries(goodAnswers()).filter(([key]) => key !== "runs_b"));
  const result = verdictFrom(TEST, answers);
  assert.equal(result.checks.runs.value, undefined);
  assert.match(result.reasons.join(" "), /runs not fully answered/);
});

test("each check yields one result, and the reasons come in role order", () => {
  const answers = { ...goodAnswers(), can_fail_c: noul(0.4), asserts_a: choice("nothing"), asserts_b: choice("nothing"), runs_a: noul(0.1), runs_b: noul(0.9), verdict: score(1) };
  const result = verdictFrom(TEST, answers, { error: "partial" });
  assert.deepEqual(Object.keys(result.checks), CHECKS.map((check) => check.name));
  assert.deepEqual(result.reasons, ["no answers (partial)", "can_fail unstable (spread 0.59)", "does not run, or narrows the run", "asserts nothing", "verdict weak"]);
  assert.deepEqual(result.checks.runs, { value: false, group: result.checks.runs.group, reasons: ["does not run, or narrows the run"], flags: [] });
  assert.deepEqual(result.checks.asserts.flags, ["nothing"]);
});

test("an exact tie escalates instead of passing", () => {
  const gate = verdictFrom(TEST, { ...goodAnswers(), runs_a: noul(0.5), runs_b: noul(0.5) });
  assert.equal(gate.checks.runs.value, undefined);
  assert.match(gate.reasons.join(" "), /runs undecided/);
  const level = verdictFrom(TEST, { ...goodAnswers(), verdict: score(1.5) });
  assert.equal(level.score.label, "weak");
  assert.equal(level.needsEyes, true);
});
