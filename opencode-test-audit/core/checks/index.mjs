// canonical source: test-audit/checks/index.mjs@45c4fac sha256:1bba058441f5486d9b59d94de1d11a3abf1d586ca64395b80a66b5cdedd97132 - vendored copy, do not edit here
// The checks: one folder for each judgement the tool asks the model about a test.
// Each `<check>/check.mjs` holds the check's questions and its role in the
// verdict; its header comment names its sources. Its `cases/` folder holds the
// calibration cases meant to catch it.
//
// This module puts the checks together into the battery: every question, in one
// call. A decision model judges each question alone against the test record, so
// each question carries its own one-line criteria; there is no shared rubric.
// The questions are data. The rules over their answers are in
// classifier/verdict.mjs, and they read each check's role.

import canFail from "./can-fail/check.mjs";
import asserts from "./asserts/check.mjs";
import positive from "./positive/check.mjs";
import runs from "./runs/check.mjs";
import conditional from "./conditional/check.mjs";
import isolated from "./isolated/check.mjs";
import deterministic from "./deterministic/check.mjs";
import automated from "./automated/check.mjs";
import restores from "./restores/check.mjs";
import resilient from "./resilient/check.mjs";
import verdict from "./verdict/check.mjs";

/** @typedef {import("../types.d.ts").Check} Check */
/** @typedef {import("../classifier/systemone.mjs").Question} Question */

/**
 * Every check, in the order the battery asks its questions: the
 * verdict-carrying checks first, then the descriptive checks in report order,
 * and the computed verdict last.
 * @type {Check[]}
 */
export const CHECKS = [
  canFail,
  asserts,
  positive,
  runs,
  conditional,
  isolated,
  deterministic,
  automated,
  restores,
  resilient,
  verdict,
];

/**
 * The whole battery for one test. All questions travel in one call, so the
 * endpoint reads the state once.
 * @type {Record<string, Question>}
 */
export const BATTERY = {};
for (const check of CHECKS) {
  for (const [key, question] of Object.entries(check.questions)) {
    if (key in BATTERY) throw new Error(`question ${key} is defined twice (check ${check.name})`);
    BATTERY[key] = question;
  }
}
