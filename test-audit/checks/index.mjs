// The checks: one folder for each judgement the tool asks the model about a test.
// Each `<check>/check.mjs` holds the check's questions, its rubric definition,
// and its role in the verdict; its header comment names its sources. Its
// `cases/` folder holds the calibration cases meant to catch it.
//
// This module puts the checks together. It builds the battery (every question,
// in one call) and the shared rubric. The questions are data. The rules over
// their answers are in classifier/verdict.mjs, and they read each check's role.

import canFail from "./can-fail/check.mjs";
import asserts from "./asserts/check.mjs";
import positive from "./positive/check.mjs";
import runs from "./runs/check.mjs";
import type from "./type/check.mjs";
import conditional from "./conditional/check.mjs";
import isolated from "./isolated/check.mjs";
import deterministic from "./deterministic/check.mjs";
import automated from "./automated/check.mjs";
import restores from "./restores/check.mjs";
import verdict from "./verdict/check.mjs";

/** @typedef {import("../types.d.ts").Check} Check */
/** @typedef {import("../classifier/systemone.mjs").Question} Question */

/**
 * Every check, in the order the battery asks its questions: the
 * verdict-carrying checks first, then `type`, then the descriptive checks in
 * report order, and the overall verdict last.
 * @type {Check[]}
 */
export const CHECKS = [
  canFail,
  asserts,
  positive,
  runs,
  type,
  conditional,
  isolated,
  deterministic,
  automated,
  restores,
  verdict,
];

/**
 * The checks that define a term in the rubric, in rubric order. The order goes
 * from what makes a guard (falsifiable, positive, runs) to the smells, and ends
 * with the type and the verdict.
 */
const RUBRIC_ORDER = [
  canFail,
  asserts,
  positive,
  runs,
  conditional,
  isolated,
  automated,
  restores,
  deterministic,
  type,
  verdict,
];

/**
 * The whole battery for one test. All questions travel in one call, so the state
 * is read once and each question costs one token.
 * @type {Record<string, Question>}
 */
export const BATTERY = {};
for (const check of CHECKS) {
  for (const [key, question] of Object.entries(check.questions)) {
    if (key in BATTERY) throw new Error(`question ${key} is defined twice (check ${check.name})`);
    BATTERY[key] = question;
  }
}

/**
 * The shared rubric sent with every test. It is the knowledge the questions
 * assume: the definition of each concept a reviewer looks for. It is short, so it
 * fits the state cap beside the test.
 */
/** What each field of the test record holds. The model sees one test, so the
 * record is all it knows about the file; a field it cannot read is evidence lost. */
const RECORD = `The test record: \`source\` is the test call. \`scope\` holds the describe heads
  around it, outermost first. \`fixtures\` holds the before and after hooks of
  those describes. \`setup\` holds the other code of those scopes, such as the
  values the file declares. \`imports\` holds the imports of the file. \`flags\`
  holds notes from the extractor: focus-in-file (an only or focus marker is
  somewhere in the file), each (a table test), and dynamic-name (a computed name).
  A field with nothing to hold is absent. A name that no field defines comes from
  code the test does not show. The change context, when present, is the diff of
  the code under test.`;

export const RUBRIC = [
  "Rubric for judging a test. Use these definitions for every question.",
  "",
  RECORD,
  "",
  ...RUBRIC_ORDER.map((check) => {
    if (!check.rubric) throw new Error(`check ${check.name} has no rubric definition`);
    return check.rubric;
  }),
].join("\n");
