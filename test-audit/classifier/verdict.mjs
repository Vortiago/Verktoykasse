// The verdict rules: reduce one test's answers to a verdict, a set of flags, and
// the reasons it escalates. Pure, so the rules are tested on hand-written answer
// objects without the model.
//
// The twin rule: each verdict-carrying judgement is asked in two or three
// phrasings, one of them negated. The rules align their polarity and trust the
// value only when the spread is inside TEST_AUDIT_STABLE_BAND. A disagreement
// escalates to a human. A third phrasing never breaks the tie. The `asserts`
// pair also lists its kinds in reverse order, as a position control.
//
// Sources:
// - Xuezhi Wang et al., Self-Consistency Improves Chain of Thought Reasoning
//   (ICLR 2023)
//   https://arxiv.org/abs/2203.11171
//   An answer that several paths agree on is more reliable than one path.
// - Melanie Sclar et al., Quantifying Language Models' Sensitivity to Spurious
//   Features in Prompt Design (ICLR 2024)
//   https://arxiv.org/abs/2310.11324
//   A small change of prompt that keeps the meaning can move accuracy by a
//   large margin, so one phrasing is not enough.
// - Lianmin Zheng et al., Judging LLM-as-a-Judge with MT-Bench and Chatbot
//   Arena (NeurIPS 2023)
//   https://arxiv.org/abs/2306.05685
//   An LLM judge prefers an answer for its position, not only its content.
// - Peiyi Wang et al., Large Language Models are not Fair Evaluators (2023)
//   https://arxiv.org/abs/2305.17926
//   Swapping the order of the options and combining the results reduces
//   position bias. That the asserts swap removes it is an inference.
// - Birgitta Böckeler, Maintainability sensors for coding agents (2026)
//   https://www.martinfowler.com/articles/sensors-for-coding-agents.html
//   An inferential sensor reports, and a human decides. So a disagreement
//   escalates and is never resolved by a vote.
// The band default (0.25), the four verdict levels, and the rule that a
// confident "cannot fail" contradicts a good verdict are house choices.

import { trusted } from "./systemone.mjs";
import { ASSERT_PASS, CAN_FAIL_KEYS, DESCRIPTIVE_KEYS, ESCALATE_ON_FALSE, FLAG_BY_GATE, NEGATED, VERDICTS } from "../checks/index.mjs";
import config from "../config.mjs";

/** @typedef {import("../types.d.ts").AuditTest} AuditTest */
/** @typedef {import("../types.d.ts").AuditAnswer} AuditAnswer */
/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").Paraphrase} Paraphrase */

/** Verdicts at or below this level escalate. */
const WEAK = VERDICTS.indexOf("weak");

/**
 * Reduce one test's answers to a verdict.
 * @param {AuditTest} test
 * @param {Record<string, AuditAnswer>} answers
 * @param {{ error?: string }} [opts]
 * @returns {AuditResult}
 */
export function verdictFrom(test, answers, opts = {}) {
  const canFail = paraphrase(CAN_FAIL_KEYS, answers);

  const assertsA = field(answers.asserts_a, "choice", "string");
  const assertsB = field(answers.asserts_b, "choice", "string");
  const assertsTrusted = assertsA !== undefined && assertsB !== undefined;
  const asserts = assertsTrusted ? assertsA : undefined;

  // A gate's value counts only when both twins answered and agree.
  /** @type {Record<string, Paraphrase>} */
  const pairs = {};
  /** @type {Record<string, boolean | undefined>} */
  const gates = {};
  for (const [gate, { keys }] of Object.entries(ESCALATE_ON_FALSE)) {
    pairs[gate] = paraphrase(keys, answers);
    gates[gate] = committed(pairs[gate], keys.length) ? /** @type {number} */ (pairs[gate].mean) >= 0.5 : undefined;
  }
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
  const reasons = escalate({
    error: opts.error,
    canFail,
    assertsTrusted,
    assertsA,
    assertsB,
    asserts,
    pairs,
    verdictIndex,
  });

  return {
    test: { file: test.file, line: test.line, name: test.name, path: test.path },
    answers,
    canFail,
    asserts: { value: asserts, a: assertsA, b: assertsB, trust: assertsTrusted, agrees: assertsTrusted && assertsA === assertsB },
    ...gates,
    pairs,
    type,
    descriptive,
    score: { value: scoreValue, label: verdict },
    flags,
    needsEyes: reasons.length > 0,
    reasons,
    error: opts.error,
  };
}

/**
 * Several phrasings of one judgement, normalised to the same polarity: their
 * values, mean, spread, and whether they agree within the band.
 * @param {string[]} keys @param {Record<string, AuditAnswer>} answers
 * @returns {Paraphrase}
 */
function paraphrase(keys, answers) {
  const values = keys.map((key) => {
    const value = field(answers[key], "noul", "number");
    if (value === undefined) return null;
    return NEGATED.has(key) ? 1 - value : value;
  });
  const present = values.filter((value) => value !== null);
  const spread = present.length >= 2 ? Math.max(...present) - Math.min(...present) : null;
  const mean = present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
  const state = stateOf(present.length, spread, config.stableBand);
  return { values, mean, spread, state, unstable: state === "borderline" || state === "unstable" };
}

/** Every phrasing answered and they agree. @param {Paraphrase} group @param {number} size */
function committed(group, size) {
  return !group.unstable && group.values.every((value) => value !== null) && group.values.length === size;
}

/** @param {number} present @param {number | null} spread @param {number} band */
function stateOf(present, spread, band) {
  if (present === 0) return "unanswered";
  if (spread === null) return "single";
  if (spread <= band) return "stable";
  return spread <= band * 2 ? "borderline" : "unstable";
}

/**
 * The reasons a test escalates to a human. An empty list is the only pass.
 * @param {{ error: string | undefined, canFail: Paraphrase, assertsTrusted: boolean, assertsA: string | undefined, assertsB: string | undefined, asserts: string | undefined, pairs: Record<string, Paraphrase>, verdictIndex: number | undefined }} input
 * @returns {string[]}
 */
function escalate({ error, canFail, assertsTrusted, assertsA, assertsB, asserts, pairs, verdictIndex }) {
  const reasons = [];
  if (error) reasons.push(`no answers (${error})`);
  reasons.push(...pairReasons("can_fail", canFail, CAN_FAIL_KEYS.length));
  // A confident "cannot fail" beside a good verdict is a contradiction: a guard
  // that never goes red cannot be good. The spread cannot see this, because the
  // three phrasings agree; only a cross-question rule catches it.
  if (canFail.mean !== null && canFail.mean < 0.5 && verdictIndex !== undefined && verdictIndex > WEAK) {
    reasons.push("can_fail contradicts the verdict");
  }
  for (const [gate, { keys, reason }] of Object.entries(ESCALATE_ON_FALSE)) {
    const pair = pairs[gate];
    const own = pairReasons(gate, pair, keys.length);
    reasons.push(...own);
    if (own.length === 0 && /** @type {number} */ (pair.mean) < 0.5) reasons.push(reason);
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
 * @template {"string" | "number"} Kind
 * @param {any} answer @param {string} key @param {Kind} kind
 * @returns {(Kind extends "string" ? string : number) | undefined}
 */
function field(answer, key, kind) {
  if (!trusted(answer) || typeof answer[key] !== kind) return undefined;
  return answer[key];
}

/** @param {AuditAnswer | undefined} answer @returns {number | undefined} */
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

/**
 * Why a paraphrase group cannot be trusted: a phrasing went unanswered, or the
 * phrasings disagree beyond the band.
 * @param {string} name @param {Paraphrase} group @param {number} size
 */
function pairReasons(name, group, size) {
  const reasons = [];
  if (group.values.filter((value) => value !== null).length < size) reasons.push(`${name} not fully answered`);
  if (group.unstable) reasons.push(`${name} ${group.state} (spread ${group.spread === null ? "-" : group.spread.toFixed(2)})`);
  return reasons;
}

/** @param {AuditAnswer | undefined} answer @returns {boolean | undefined} */
function boolOf(answer) {
  const value = field(answer, "noul", "number");
  return value === undefined ? undefined : value >= 0.5;
}
