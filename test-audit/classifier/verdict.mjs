// The verdict rules: reduce one test's answers to a verdict, a set of flags, and
// the reasons it escalates. Pure, so the rules are tested on hand-written answer
// objects without the model.

import { trusted } from "./systemone.mjs";
import { VERDICTS, CAN_FAIL_KEYS, DESCRIPTIVE_KEYS } from "./battery.mjs";
import { HARD_FLAGS } from "../change/index.mjs";
import config from "../config.mjs";

/** Verdicts at or below this level escalate. */
const WEAK = VERDICTS.indexOf("weak");

/** The flag a false answer to each descriptive question raises. */
const FLAG_BY_GATE = {
  observable: "implementation-coupled",
  conditional: "conditional",
  isolated: "order-dependent",
  controlled: "uncontrolled-resource",
  specific: "weak-assert",
  named: "vague-name",
  deterministic: "non-deterministic",
  one_thing: "eager",
  name_matches: "name-mismatch",
  resilient: "structure-dependent",
  diagnostic: "silent-failure",
  fixture: "general-fixture",
  fast: "slow",
  readable: "obscure",
  magic_number: "magic-number",
};

/**
 * Reduce one test's answers to a verdict.
 * @param {object} test
 * @param {Record<string, any>} answers
 * @param {{ config?: object, smellFlags?: string[], error?: string }} [opts]
 */
export function verdictFrom(test, answers, opts = {}) {
  const cfg = opts.config ?? config;
  const values = CAN_FAIL_KEYS.map((key) => canFailValue(key, answers[key], cfg));
  const present = values.filter((value) => value !== null);
  const spread = present.length >= 2 ? Math.max(...present) - Math.min(...present) : null;
  const mean = present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
  const canFailState = canFailStateOf(present.length, spread, cfg.stableBand);

  const assertsA = choiceOf(answers.asserts_a, cfg);
  const assertsB = choiceOf(answers.asserts_b, cfg);
  const assertsTrusted = assertsA !== undefined && assertsB !== undefined;
  const asserts = assertsTrusted ? assertsA : undefined;

  const type = choiceOf(answers.type, cfg);
  const descriptive = {};
  for (const gate of DESCRIPTIVE_KEYS) descriptive[gate] = boolOf(answers[gate], cfg);
  const scoreValue = scoreOf(answers.verdict, cfg);
  const verdictIndex = verdictIndexOf(scoreValue);
  const verdict = verdictIndex === undefined ? undefined : VERDICTS[verdictIndex];

  // The descriptive questions report as flags; only the hard static smells and
  // the verdict-carrying answers escalate.
  /** @type {string[]} */
  const flagList = [...(opts.smellFlags ?? [])];
  if (asserts && asserts !== "behaviour") flagList.push(asserts);
  for (const gate of DESCRIPTIVE_KEYS) {
    if (descriptive[gate] === false) flagList.push(FLAG_BY_GATE[gate]);
  }
  const flags = [...new Set(flagList)];
  const reasons = escalate({
    error: opts.error,
    answered: present.length === CAN_FAIL_KEYS.length,
    canFailState,
    canFailMean: mean,
    spread,
    assertsTrusted,
    assertsA,
    assertsB,
    asserts,
    verdict,
    flags,
  });

  return {
    test: { file: test.file, line: test.line, name: test.name, path: test.path },
    answers,
    canFail: { values, mean, spread, state: canFailState },
    asserts: { value: asserts, a: assertsA, b: assertsB, trust: assertsTrusted, agrees: assertsTrusted && assertsA === assertsB },
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
function canFailValue(key, answer, cfg) {
  if (!answer || typeof answer.noul !== "number" || !trusted(answer, cfg.minMass)) return null;
  return key === "can_fail_b" ? 1 - answer.noul : answer.noul;
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
function escalate({ error, answered, canFailState, canFailMean, spread, assertsTrusted, assertsA, assertsB, asserts, verdict, flags }) {
  const reasons = [];
  if (error) reasons.push(`no answers (${error})`);
  if (!answered) reasons.push("can_fail not fully answered");
  if (canFailState === "borderline" || canFailState === "unstable") {
    reasons.push(`can_fail ${canFailState} (spread ${spread === null ? "-" : spread.toFixed(2)})`);
  }
  // A confident "cannot fail" beside a good verdict is a contradiction: a guard
  // that never goes red cannot be good. The spread cannot see this, because the
  // three phrasings agree; only a cross-question rule catches it.
  if (canFailMean !== null && canFailMean < 0.5 && (verdict === "good" || verdict === "strong")) {
    reasons.push("can_fail contradicts the verdict");
  }
  if (!assertsTrusted) reasons.push("asserts unclassified");
  else if (assertsA !== assertsB) reasons.push(`asserts unstable (${assertsA} vs ${assertsB})`);
  else if (asserts === "nothing") reasons.push("asserts nothing");
  if (verdict === undefined) reasons.push("verdict unclassified");
  else if (VERDICTS.indexOf(verdict) <= WEAK) reasons.push(`verdict ${verdict}`);
  for (const flag of flags) if (HARD_FLAGS.has(flag)) reasons.push(flag);
  return reasons;
}

/** @param {any} answer @param {object} cfg */
function choiceOf(answer, cfg) {
  return answer && trusted(answer, cfg.minMass) && typeof answer.choice === "string" ? answer.choice : undefined;
}

/** @param {any} answer @param {object} cfg @returns {number | undefined} */
function scoreOf(answer, cfg) {
  if (!answer || !trusted(answer, cfg.minMass) || typeof answer.score !== "number" || !Number.isFinite(answer.score)) return undefined;
  return answer.score;
}

/**
 * The score answer is a continuous expected level, so it lands between two
 * levels. Round to the nearest level for the label; a value off the scale is
 * not a verdict.
 * @param {number | undefined} score
 * @returns {number | undefined}
 */
function verdictIndexOf(score) {
  if (score === undefined || score < -0.5 || score > VERDICTS.length - 0.5) return undefined;
  return Math.round(score);
}

/** @param {any} answer @param {object} cfg @returns {boolean | undefined} */
function boolOf(answer, cfg) {
  if (!answer || typeof answer.noul !== "number" || !trusted(answer, cfg.minMass)) return undefined;
  return answer.noul >= 0.5;
}
