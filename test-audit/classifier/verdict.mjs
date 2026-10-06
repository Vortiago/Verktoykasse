// The verdict rules: reduce one test's answers to a verdict, a set of flags, and
// the reasons it escalates. Pure, so the rules are tested on hand-written answer
// objects without the model.
//
// Each check in checks/ has a role, and the role says what the rules do with
// its answers. The rules read the rest from the check itself: its negated
// phrasings, its assert kinds, its escalation reason, its flag, and its levels.
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

/** A verdict at or below this level escalates. */
const WEAK = "weak";

/** The roles whose reasons escalate a test, in the order the result lists them. */
const REASON_ORDER = ["can-fail", "gate", "asserts", "verdict"];

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
  /** @type {CheckResult | undefined} */
  let verdict;
  /** @type {Pick<AuditResult, "asserts" | "type" | "score">} */
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
      case "type": {
        const [key] = Object.keys(check.questions);
        views.type = field(answers[key], "choice", "string");
        checks[check.name] = { value: views.type, reasons: [], flags: [] };
        break;
      }
      case "descriptive": {
        // A descriptive answer reports as a flag. It never escalates.
        const [key] = Object.keys(check.questions);
        const value = boolOf(answers[key]);
        checks[check.name] = { value, reasons: [], flags: value === false ? [check.flag] : [] };
        break;
      }
      case "verdict": {
        const [key] = Object.keys(check.questions);
        const score = scoreOf(answers[key]);
        const label = levelOf(score, check.levels);
        /** @type {string[]} */
        const reasons = [];
        if (label === undefined) reasons.push(`${check.name} unclassified`);
        else if (check.levels.indexOf(label) <= check.levels.indexOf(WEAK)) reasons.push(`${check.name} ${label}`);
        verdict = checks[check.name] = { value: label, reasons, flags: [] };
        views.score = { value: score, label };
        break;
      }
    }
  }
  // A confident "cannot fail" beside a good verdict is a contradiction: a guard
  // that never goes red cannot be good. The spread cannot see this, because the
  // three phrasings agree; only a cross-question rule catches it. A verdict with
  // no reason is good or better.
  const mean = canFail?.group?.mean;
  if (canFail && typeof mean === "number" && mean < YES && verdict?.reasons.length === 0) {
    canFail.reasons.push("can_fail contradicts the verdict");
  }

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
    type: views.type,
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
  if (check?.role === "verdict") return levelOf(scoreOf(answer), check.levels);
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
  const value = committed(group) && group.mean !== null ? group.mean >= YES : undefined;
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

/** @param {AuditAnswer | undefined} answer @returns {number | undefined} */
function scoreOf(answer) {
  const score = field(answer, "score", "number");
  return Number.isFinite(score) ? score : undefined;
}

/**
 * The score answer is a continuous expected level, so it lands between two
 * levels. Round to the nearest level; a value off the scale is not a verdict.
 * @param {number | undefined} score @param {string[]} levels
 * @returns {string | undefined}
 */
function levelOf(score, levels) {
  if (score === undefined || score < -0.5 || score >= levels.length - 0.5) return undefined;
  return levels[Math.round(score)];
}
