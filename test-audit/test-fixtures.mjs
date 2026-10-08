// Shared fixtures for the unit tests: hand-written answers, so the verdict rules
// and the calibration faces are tested without the model. `goodAnswers` reads
// the checks, so a new question needs no edit here. Not shipped (package.json).

import { CHECKS } from "./checks/index.mjs";

/** @typedef {import("./types.d.ts").AuditAnswer} AuditAnswer */

/** A trusted yes/no answer. @param {number} value @param {number} [mass] @returns {AuditAnswer} */
export const noul = (value, mass = 0.99) => ({ type: "noul", probabilities: {}, confidence: 0.9, mass, noul: value });


/**
 * A passing battery: every yes/no question says the good answer (a negated
 * phrasing says no), so every check gives its good value.
 * @returns {Record<string, AuditAnswer>}
 */
export function goodAnswers() {
  /** @type {Record<string, AuditAnswer>} */
  const answers = {};
  for (const check of CHECKS) {
    for (const key of Object.keys(check.questions)) {
      answers[key] = noul(check.negated?.includes(key) ? 0.01 : 0.99);
    }
  }
  return answers;
}

/**
 * The asserts answers that give one kind: the yes/no answer to each fact
 * question. Spread them over goodAnswers().
 * @param {"behaviour" | "from-code" | "inexact" | "shape-only" | "interaction-only"} kind
 * @param {number} [sure] how far each answer sits from 0.5
 * @returns {Record<string, AuditAnswer>}
 */
export function assertsAs(kind, sure = 0.49) {
  const yes = 0.5 + sure;
  const no = 0.5 - sure;
  return {
    asserts_exact: noul(["behaviour", "from-code"].includes(kind) ? yes : no),
    asserts_written: noul(kind === "from-code" ? no : yes),
    asserts_same: noul(kind === "from-code" ? yes : no),
    asserts_shape: noul(kind === "shape-only" ? yes : no),
    asserts_mock: noul(kind === "interaction-only" ? yes : no),
  };
}
