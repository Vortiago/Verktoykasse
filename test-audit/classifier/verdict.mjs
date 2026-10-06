// The verdict rules: reduce one test's answers to a verdict, a set of flags, and
// the reasons it escalates. Pure, so the rules are tested on hand-written answer
// objects without the model.

import { trusted } from "./systemone.mjs";
import { ASSERT_PASS, CAN_FAIL_KEYS, CAN_FAIL_NEGATED, DESCRIPTIVE_KEYS, ESCALATE_ON_FALSE, FLAG_BY_GATE, VERDICTS } from "./battery.mjs";
import config from "../config.mjs";

/** Verdicts at or below this level escalate. */
const WEAK = VERDICTS.indexOf("weak");

/**
 * Reduce one test's answers to a verdict.
 * @param {{ file: string, line: number, name: string, path: string[], flags?: string[] }} test
 * @param {Record<string, any>} answers
 * @param {{ error?: string }} [opts]
 */
export function verdictFrom(test, answers, opts = {}) {
  const values = CAN_FAIL_KEYS.map((key) => canFailValue(key, answers[key]));
  const present = values.filter((value) => value !== null);
  const spread = present.length >= 2 ? Math.max(...present) - Math.min(...present) : null;
  const mean = present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
  const canFailState = canFailStateOf(present.length, spread, config.stableBand);

  const assertsA = field(answers.asserts_a, "choice", "string");
  const assertsB = field(answers.asserts_b, "choice", "string");
  const assertsTrusted = assertsA !== undefined && assertsB !== undefined;
  const asserts = assertsTrusted ? assertsA : undefined;

  /** @type {Record<string, boolean | undefined>} */
  const gates = {};
  for (const gate of Object.keys(ESCALATE_ON_FALSE)) gates[gate] = boolOf(answers[gate]);
  const type = field(answers.type, "choice", "string");
  /** @type {Record<string, boolean | undefined>} */
  const descriptive = {};
  for (const gate of DESCRIPTIVE_KEYS) descriptive[gate] = boolOf(answers[gate]);
  const scoreValue = scoreOf(answers.verdict);
  const verdictIndex = verdictIndexOf(scoreValue);
  const verdict = verdictIndex === undefined ? undefined : VERDICTS[verdictIndex];

  // The descriptive questions and the extractor's own notes report as flags.
  // The verdict-carrying answers (the ESCALATE_ON_FALSE gates, can_fail,
  // asserts, verdict) are what escalate.
  /** @type {string[]} */
  const flagList = [...(test.flags ?? [])];
  if (asserts && asserts !== ASSERT_PASS) flagList.push(asserts);
  for (const gate of DESCRIPTIVE_KEYS) {
    if (descriptive[gate] === false) flagList.push(FLAG_BY_GATE[gate]);
  }
  const flags = [...new Set(flagList)];
  const canFailUnstable = canFailState === "borderline" || canFailState === "unstable";
  const reasons = escalate({
    error: opts.error,
    answered: present.length === CAN_FAIL_KEYS.length,
    canFailUnstable,
    canFailState,
    canFailMean: mean,
    spread,
    assertsTrusted,
    assertsA,
    assertsB,
    asserts,
    gates,
    verdictIndex,
  });

  return {
    test: { file: test.file, line: test.line, name: test.name, path: test.path },
    answers,
    canFail: { values, mean, spread, state: canFailState, unstable: canFailUnstable },
    asserts: { value: asserts, a: assertsA, b: assertsB, trust: assertsTrusted, agrees: assertsTrusted && assertsA === assertsB },
    ...gates,
    type,
    descriptive,
    score: { value: scoreValue, label: verdict },
    flags,
    needsEyes: reasons.length > 0,
    reasons,
    error: opts.error,
  };
}

/** P(can fail) from one phrasing, or null when the answer is not trusted. */
function canFailValue(key, answer) {
  const value = field(answer, "noul", "number");
  if (value === undefined) return null;
  return CAN_FAIL_NEGATED.has(key) ? 1 - value : value;
}

/** @param {number} present @param {number | null} spread @param {number} band */
function canFailStateOf(present, spread, band) {
  if (present === 0) return "unanswered";
  if (spread === null) return "single";
  if (spread <= band) return "stable";
  return spread <= band * 2 ? "borderline" : "unstable";
}

/**
 * The reasons a test escalates to a human. An empty list is the only pass.
 * @returns {string[]}
 */
function escalate({ error, answered, canFailUnstable, canFailState, canFailMean, spread, assertsTrusted, assertsA, assertsB, asserts, gates, verdictIndex }) {
  const reasons = [];
  if (error) reasons.push(`no answers (${error})`);
  if (!answered) reasons.push("can_fail not fully answered");
  if (canFailUnstable) {
    reasons.push(`can_fail ${canFailState} (spread ${spread === null ? "-" : spread.toFixed(2)})`);
  }
  // A confident "cannot fail" beside a good verdict is a contradiction: a guard
  // that never goes red cannot be good. The spread cannot see this, because the
  // three phrasings agree; only a cross-question rule catches it.
  if (canFailMean !== null && canFailMean < 0.5 && verdictIndex !== undefined && verdictIndex > WEAK) {
    reasons.push("can_fail contradicts the verdict");
  }
  for (const [gate, reason] of Object.entries(ESCALATE_ON_FALSE)) {
    if (gates[gate] === undefined) reasons.push(`${gate} unclassified`);
    else if (gates[gate] === false) reasons.push(reason);
  }
  // The assertion must check the behaviour. A shape, a hardcoded table, a mock
  // call, or nothing at all is not a guard, so any other answer escalates.
  if (!assertsTrusted) reasons.push("asserts unclassified");
  else if (assertsA !== assertsB) reasons.push(`asserts unstable (${assertsA} vs ${assertsB})`);
  else if (asserts !== ASSERT_PASS) reasons.push(`asserts ${asserts}`);
  if (verdictIndex === undefined) reasons.push("verdict unclassified");
  else if (verdictIndex <= WEAK) reasons.push(`verdict ${VERDICTS[verdictIndex]}`);
  return reasons;
}

/**
 * One trusted field of an answer, or undefined when the answer is missing,
 * below the mass floor, or of the wrong type.
 * @param {any} answer @param {string} key @param {"string" | "number"} kind
 */
function field(answer, key, kind) {
  if (!trusted(answer) || typeof answer[key] !== kind) return undefined;
  return answer[key];
}

/** @param {any} answer @returns {number | undefined} */
function scoreOf(answer) {
  const score = field(answer, "score", "number");
  return Number.isFinite(score) ? score : undefined;
}

/**
 * The score answer is a continuous expected level, so it lands between two
 * levels. Round to the nearest level for the label; a value off the scale is
 * not a verdict.
 * @param {number | undefined} score
 * @returns {number | undefined}
 */
function verdictIndexOf(score) {
  if (score === undefined || score < -0.5 || score >= VERDICTS.length - 0.5) return undefined;
  return Math.round(score);
}

/** @param {any} answer @returns {boolean | undefined} */
function boolOf(answer) {
  const value = field(answer, "noul", "number");
  return value === undefined ? undefined : value >= 0.5;
}
