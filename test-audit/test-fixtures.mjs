// Shared fixtures for the unit tests: hand-written answers, so the verdict rules
// and the calibration faces are tested without the model. `goodAnswers` reads
// the checks, so a new question needs no edit here. Not shipped (package.json).

import { CHECKS } from "./checks/index.mjs";

/** @typedef {import("./types.d.ts").AuditAnswer} AuditAnswer */

/** A trusted yes/no answer. @param {number} value @param {number} [mass] @returns {AuditAnswer} */
export const noul = (value, mass = 0.99) => ({ type: "noul", probabilities: {}, confidence: 0.9, mass, noul: value });

/** A trusted choice answer that gives the chosen kind a probability of 0.9. @param {string} value @param {number} [mass] @returns {AuditAnswer} */
export const choice = (value, mass = 0.99) => ({ type: "choice", probabilities: { [value]: 0.9 }, confidence: 0.9, mass, choice: value });

/** A trusted score answer. @param {number} value @param {number} [mass] @returns {AuditAnswer} */
export const score = (value, mass = 0.99) => ({ type: "score", probabilities: {}, confidence: 0.9, mass, score: value });

/**
 * A passing battery: every yes/no question says the good answer (a negated
 * phrasing says no), every asserts phrasing says the one real guard, the type
 * is its first label, and the verdict is the top level.
 * @returns {Record<string, AuditAnswer>}
 */
export function goodAnswers() {
  /** @type {Record<string, AuditAnswer>} */
  const answers = {};
  for (const check of CHECKS) {
    for (const [key, question] of Object.entries(check.questions)) {
      if (check.role === "asserts") answers[key] = choice(Object.keys(check.kinds)[0]);
      else if (Array.isArray(question.criteria)) answers[key] = score(question.criteria.length - 1);
      else if (question.type === "choice") answers[key] = choice(Object.keys(question.criteria)[0]);
      else answers[key] = noul(check.negated?.includes(key) ? 0.01 : 0.99);
    }
  }
  return answers;
}
