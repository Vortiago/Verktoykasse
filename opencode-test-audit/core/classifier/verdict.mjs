// canonical source: test-audit/classifier/verdict.mjs@45c4fac sha256:55d4810812fd23e28e264cd3e9c9ec196d6897722bcb267650df8fd683f44581 - vendored copy, do not edit here
// The verdict rules: reduce one test's answers to a verdict, a set of flags, and
// the reasons it escalates. Pure, so the rules are tested on hand-written answer
// objects without the model.
//
// Each check in checks/ has a role, and the role says what the rules do with
// its answers. The rules read the rest from the check itself: its negated
// phrasings, its assert kinds, its escalation reason, its flag, and its levels.
//
// The twin rule: each verdict-carrying judgement is asked in two phrasings, both
// asked the plain way round: a decision model answers a negation less
// reliably. The rules trust the value only when the spread is inside
// TEST_AUDIT_STABLE_BAND. A disagreement escalates to a human; it is never
// broken by a vote. The `asserts` pair also lists its kinds in reverse order,
// as a position control, and offers `unclear`, which escalates.
//
// The verdict is not asked. It is computed from the answers that carry it, so
// each question judges one thing, and code owns the composition.
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
// - TypeSafe AI, System One docs: one specific, well-scoped question each;
//   double negatives are answered less reliably; code owns composition.
//   https://docs.typesafe.ai/
// The band default (0.25), the three verdict levels, and the rule that "cannot
// fail" contradicts a behaviour assertion are house choices.

import { trusted } from "./systemone.mjs";
import { CHECKS } from "../checks/index.mjs";
import config from "../config.mjs";

/** @typedef {import("../types.d.ts").AuditTest} AuditTest */
/** @typedef {import("../types.d.ts").AuditAnswer} AuditAnswer */
/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").Check} Check */
/** @typedef {import("../types.d.ts").CheckResult} CheckResult */
/** @typedef {import("../types.d.ts").Paraphrase} Paraphrase */

/** A yes/no answer at or above this reads as yes. */
const YES = 0.5;

/** The assert kinds that leave a test unable to guard anything: the verdict is slop. */
const SLOP_KINDS = ["nothing", "from-code"];
/** The assert kinds that check something, but not the behaviour: the verdict is weak. */
const WEAK_KINDS = ["shape-only", "interaction-only", "input-only"];

/** The roles whose reasons escalate a test, in the order the result lists them. */
const REASON_ORDER = ["can-fail", "gate", "asserts"];

/** The check that asks each question, keyed by the question. */
const OWNER = new Map(CHECKS.flatMap((check) => Object.keys(check.questions).map((key) => /** @type {const} */ ([key, check]))));

/**
 * Reduce one test's answers to a verdict: one result for each check, and the
 * views the reports read.
 * @param {AuditTest} test
 * @param {Record<string, AuditAnswer>} answers
 * @param {{ error?: string }} [opts]
 * @returns {AuditResult}
 */
export function verdictFrom(test, answers, opts = {}) {
  /** @type {Record<string, CheckResult>} */
  const checks = {};
  /** @type {CheckResult | undefined} */
  let canFail;
  /** @type {Pick<AuditResult, "asserts" | "score">} */
  const views = { score: {} };
  for (const check of CHECKS) {
    switch (check.role) {
      case "can-fail":
        canFail = checks[check.name] = yesNo(check, answers);
        break;
      case "gate": {
        const result = yesNo(check, answers);
        // A twin pair that both answered and agree on "no" escalates.
        if (result.value === false) result.reasons.push(check.reason);
        checks[check.name] = result;
        break;
      }
      case "asserts": {
        // The assertion must check the behaviour. A shape, a hardcoded table, a
        // mock call, or nothing at all is not a guard, so any other kind escalates.
        const group = phrasings(check, answers);
        const [first] = group.values;
        const kind = committed(group) && typeof first === "string" ? first : undefined;
        const pass = Object.keys(check.kinds)[0];
        /** @type {string[]} */
        const reasons = [];
        if (group.values.includes(null)) reasons.push(`${check.name} unclassified`);
        else if (group.unstable) reasons.push(`${check.name} unstable (${group.values.join(" vs ")})`);
        else if (kind !== pass) reasons.push(`${check.name} ${kind}`);
        checks[check.name] = { value: kind, group, reasons, flags: kind && kind !== pass ? [kind] : [] };
        views.asserts = kind;
        break;
      }
      case "descriptive": {
        // A descriptive answer reports as a flag. It never escalates.
        const [key] = Object.keys(check.questions);
        const value = boolOf(answers[key]);
        checks[check.name] = { value, reasons: [], flags: value === false ? [check.flag] : [] };
        break;
      }
      case "verdict":
        // No questions: the verdict is computed below, from the other checks.
        break;
    }
  }

  // The verdict, from the answers that carry it. It adds no reason: each answer
  // behind a slop or weak level already escalates on its own.
  const kind = views.asserts;
  const verdictCheck = CHECKS.find((check) => check.role === "verdict");
  /** @type {string | undefined} */
  let level;
  if (canFail?.value === false || (kind && SLOP_KINDS.includes(kind))) level = "slop";
  else if ((kind && WEAK_KINDS.includes(kind)) || checks.positive?.value === false) level = "weak";
  else if (canFail?.value === true && kind === "behaviour") level = "good";
  if (verdictCheck?.role === "verdict") {
    checks[verdictCheck.name] = { value: level, reasons: [], flags: [] };
    if (level) views.score = { value: verdictCheck.levels.indexOf(level), label: level };
  }

  // Answers that contradict each other: a test that cannot fail cannot also
  // check the behaviour. Each answer is stable on its own, so only a rule across
  // questions sees it.
  if (canFail?.value === false && kind === "behaviour") canFail.reasons.push("can_fail contradicts asserts");

  const reasons = [
    ...(opts.error ? [`no answers (${opts.error})`] : []),
    ...REASON_ORDER.flatMap((role) => CHECKS.filter((check) => check.role === role).flatMap((check) => checks[check.name].reasons)),
  ];
  // The extractor's notes and the flags of the checks report; only the reasons escalate.
  const flags = [...new Set([...(test.flags ?? []), ...Object.values(checks).flatMap((result) => result.flags)])];
  return {
    test: { file: test.file, line: test.line, name: test.name, path: test.path },
    answers,
    checks,
    canFail: canFail?.group,
    asserts: views.asserts,
    score: views.score,
    flags,
    needsEyes: reasons.length > 0,
    reasons,
    error: opts.error,
  };
}

/**
 * The value of one answer, as the rules read it: yes or no for a yes/no
 * question, the kind for a choice, and the level for a score. Undefined when the
 * answer is missing, untrusted, of the wrong type, or off the scale. A negated
 * phrasing is read as it is asked, not flipped.
 * @param {string} key @param {AuditAnswer | undefined} answer
 * @returns {boolean | string | undefined}
 */
export function questionValue(key, answer) {
  const check = OWNER.get(key);
  const type = check?.questions[key].type;
  if (type === "noul") return boolOf(answer);
  if (type === "choice") return field(answer, "choice", "string");
  return undefined;
}

/**
 * A yes/no judgement asked in one or more phrasings. Its value is yes or no only
 * when every phrasing answered and they agree. A phrasing that is missing, or
 * phrasings that disagree beyond the band, escalate.
 * @param {Check} check @param {Record<string, AuditAnswer>} answers
 * @returns {CheckResult}
 */
function yesNo(check, answers) {
  const group = phrasings(check, answers);
  /** @type {string[]} */
  const reasons = [];
  if (group.values.includes(null)) reasons.push(`${check.name} not fully answered`);
  if (group.unstable) reasons.push(`${check.name} ${group.state} (spread ${group.spread?.toFixed(2) ?? "-"})`);
  // An exact tie is no answer: it would otherwise read as yes and pass a gate.
  const tied = committed(group) && group.mean === YES;
  if (tied) reasons.push(`${check.name} undecided (mean ${YES})`);
  const value = committed(group) && group.mean !== null && !tied ? group.mean > YES : undefined;
  return { value, group, reasons, flags: [] };
}

/**
 * The phrasings of one judgement, aligned to one polarity: the answer to a
 * negated yes/no phrasing is flipped, and a choice is read as it is. Yes/no
 * phrasings agree when their spread is inside the band; choices agree when they
 * name one kind.
 * @param {Check} check @param {Record<string, AuditAnswer>} answers
 * @returns {Paraphrase}
 */
function phrasings(check, answers) {
  const negated = new Set(check.negated);
  const values = Object.entries(check.questions).map(([key, question]) => {
    if (question.type === "choice") return field(answers[key], "choice", "string") ?? null;
    const value = field(answers[key], "noul", "number");
    if (value === undefined) return null;
    return negated.has(key) ? 1 - value : value;
  });
  const present = values.filter((value) => value !== null);
  const numbers = present.filter((value) => typeof value === "number");
  const spread = numbers.length >= 2 ? Math.max(...numbers) - Math.min(...numbers) : null;
  const mean = numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null;
  const state = stateOf(present, spread, config.stableBand);
  return { values, mean, spread, state, unstable: state === "borderline" || state === "unstable" };
}

/** Every phrasing answered, and they agree. @param {Paraphrase} group */
function committed(group) {
  return !group.unstable && !group.values.includes(null);
}

/**
 * unanswered, single, stable, borderline, or unstable. Choices have no spread:
 * they are stable when they name one kind, and unstable otherwise.
 * @param {Array<number | string>} present @param {number | null} spread @param {number} band
 */
function stateOf(present, spread, band) {
  if (present.length === 0) return "unanswered";
  if (present.length === 1) return "single";
  if (spread === null) return new Set(present).size === 1 ? "stable" : "unstable";
  if (spread <= band) return "stable";
  return spread <= band * 2 ? "borderline" : "unstable";
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

/** @param {AuditAnswer | undefined} answer @returns {boolean | undefined} */
function boolOf(answer) {
  const value = field(answer, "noul", "number");
  return value === undefined ? undefined : value >= YES;
}
