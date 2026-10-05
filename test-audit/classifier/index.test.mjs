// Unit tests for the battery and the verdict rules. Every answer is written by
// hand, so the escalation logic is tested without the model: the property that
// makes `classify` an injectable-ask function.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildState, classify } from "./index.mjs";
import { batteryQuestions, CAN_FAIL_KEYS, DESCRIPTIVE_KEYS, RUBRIC } from "./battery.mjs";
import { verdictFrom } from "./verdict.mjs";

const TEST = { file: "add.test.mjs", line: 1, name: "add", path: [], source: 'test("add", () => { expect(add(1, 1)).toBe(2); });', fixtures: [], imports: [] };

/** A trusted yes/no answer. */
const noul = (value, mass = 0.99) => ({ type: "noul", probabilities: {}, confidence: 0.9, mass, noul: value });
/** A trusted choice answer. */
const choice = (value, mass = 0.99) => ({ type: "choice", probabilities: {}, confidence: 0.9, mass, choice: value });
/** A trusted score answer. */
const score = (value, mass = 0.99) => ({ type: "score", probabilities: {}, confidence: 0.9, mass, score: value });

/** A passing battery: the test can fail, asserts behaviour, and scores strong. */
function goodAnswers() {
  return {
    can_fail_a: noul(0.99),
    can_fail_b: noul(0.01),
    can_fail_c: noul(0.98),
    asserts_a: choice("behaviour"),
    asserts_b: choice("behaviour"),
    positive: noul(0.99),
    runs: noul(0.99),
    type: choice("unit"),
    observable: noul(0.99),
    conditional: noul(0.99),
    isolated: noul(0.99),
    controlled: noul(0.99),
    specific: noul(0.99),
    named: noul(0.99),
    deterministic: noul(0.99),
    one_thing: noul(0.99),
    name_matches: noul(0.99),
    resilient: noul(0.99),
    diagnostic: noul(0.99),
    fixture: noul(0.99),
    fast: noul(0.99),
    readable: noul(0.99),
    magic_number: noul(0.99),
    reads_output: noul(0.99),
    automated: noul(0.99),
    restores: noul(0.99),
    verdict: score(3),
  };
}

test("the battery carries the whole question set once", () => {
  const questions = batteryQuestions();
  assert.deepEqual(Object.keys(questions), [...CAN_FAIL_KEYS, "asserts_a", "asserts_b", "positive", "runs", "type", ...DESCRIPTIVE_KEYS, "verdict"]);
  assert.deepEqual(Object.keys(questions.asserts_b.criteria), [...Object.keys(questions.asserts_a.criteria)].reverse());
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

test("a clean test does not escalate", () => {
  const result = verdictFrom(TEST, goodAnswers());
  assert.equal(result.needsEyes, false);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.score.label, "strong");
  assert.equal(result.canFail.state, "stable");
  assert.equal(result.asserts.value, "behaviour");
});

test("a paraphrase spread above the band is instability, not a tie to break", () => {
  // The tautology the live probe missed: one phrasing says yes, its twins say no.
  const result = verdictFrom(TEST, { ...goodAnswers(), can_fail_a: noul(0.92), can_fail_b: noul(0.99), can_fail_c: noul(0.88) });
  assert.equal(result.canFail.state, "unstable");
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /can_fail unstable/);
});

test("a small spread stays stable but a middle one is borderline", () => {
  const stable = verdictFrom(TEST, { ...goodAnswers(), can_fail_c: noul(0.80) });
  assert.equal(stable.canFail.state, "stable");
  assert.equal(stable.needsEyes, false);
  const borderline = verdictFrom(TEST, { ...goodAnswers(), can_fail_c: noul(0.65) });
  assert.equal(borderline.canFail.state, "borderline");
  assert.equal(borderline.needsEyes, true);
});

test("an untrusted answer escalates rather than passing silently", () => {
  const result = verdictFrom(TEST, { ...goodAnswers(), can_fail_a: noul(0.99, 0.1) });
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /can_fail not fully answered/);
});

test("asserts that disagree escalate, and any non-behaviour assertion escalates", () => {
  const disagree = verdictFrom(TEST, { ...goodAnswers(), asserts_b: choice("shape-only") });
  assert.equal(disagree.asserts.trust, true);
  assert.equal(disagree.asserts.agrees, false);
  assert.match(disagree.reasons.join(" "), /asserts unstable/);

  for (const kind of ["nothing", "shape-only", "hardcoded-data", "interaction-only"]) {
    const result = verdictFrom(TEST, { ...goodAnswers(), asserts_a: choice(kind), asserts_b: choice(kind) });
    assert.equal(result.needsEyes, true, kind);
    assert.match(result.reasons.join(" "), new RegExp(`asserts ${kind}`));
    assert.ok(result.flags.includes(kind));
  }
});

test("a test with no positive assertion escalates", () => {
  const result = verdictFrom(TEST, { ...goodAnswers(), positive: noul(0.1) });
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
  const result = verdictFrom(TEST, { ...goodAnswers(), runs: noul(0.1) });
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /does not run/);
});

test("descriptive gates report as flags without escalating", () => {
  const off = Object.fromEntries(DESCRIPTIVE_KEYS.map((gate) => [gate, noul(0.1)]));
  const result = verdictFrom(TEST, { ...goodAnswers(), ...off });
  assert.equal(result.needsEyes, false);
  for (const flag of ["implementation-coupled", "conditional", "order-dependent", "uncontrolled-resource", "weak-assert", "vague-name", "non-deterministic", "eager", "name-mismatch", "structure-dependent", "silent-failure", "general-fixture", "slow", "obscure", "magic-number", "asserts-input", "manual", "state-leak"]) {
    assert.ok(result.flags.includes(flag), flag);
  }
});

test("a good verdict beside a stable cannot-fail answer escalates", () => {
  // The three phrasings agree the test cannot fail, yet the verdict says strong.
  const result = verdictFrom(TEST, { ...goodAnswers(), can_fail_a: noul(0.2), can_fail_b: noul(0.8), can_fail_c: noul(0.25) });
  assert.equal(result.canFail.state, "stable");
  assert.equal(result.canFail.mean < 0.5, true);
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /can_fail contradicts the verdict/);
});

test("a transport failure is an audit failure", () => {
  const result = verdictFrom(TEST, {}, { error: "systemone 503: busy" });
  assert.equal(result.needsEyes, true);
  assert.match(result.reasons.join(" "), /no answers/);
});

test("classify asks once with the state and the whole battery", async () => {
  let seen;
  const ask = async (state, questions) => {
    seen = { state, questions };
    return goodAnswers();
  };
  const result = await classify(TEST, { ask, changeContext: "the change" });
  assert.match(seen.state, /add\.test\.mjs/);
  assert.match(seen.state, /the change/);
  assert.deepEqual(Object.keys(seen.questions), Object.keys(batteryQuestions()));
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
    positive: { noul: 0.99 },
    runs: { noul: 0.99 },
    type: { choice: "unit" },
    deterministic: { noul: 0.99 },
    one_thing: { noul: 0.99 },
    name_matches: { noul: 0.99 },
    verdict: { score: 3 },
  };
  const result = verdictFrom(TEST, answers);
  assert.equal(result.canFail.state, "stable");
  assert.equal(result.asserts.value, "behaviour");
  assert.equal(result.needsEyes, false);
});
