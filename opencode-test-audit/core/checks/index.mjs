// canonical source: test-audit/checks/index.mjs@4ba9d42 sha256:59724b9ef4a8c0ebe831cc8d5f222bc677b462b3ab00e66053bba137cff34b03 - vendored copy, do not edit here
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
import observable from "./observable/check.mjs";
import conditional from "./conditional/check.mjs";
import isolated from "./isolated/check.mjs";
import controlled from "./controlled/check.mjs";
import specific from "./specific/check.mjs";
import named from "./named/check.mjs";
import deterministic from "./deterministic/check.mjs";
import oneThing from "./one-thing/check.mjs";
import nameMatches from "./name-matches/check.mjs";
import resilient from "./resilient/check.mjs";
import diagnostic from "./diagnostic/check.mjs";
import fixture from "./fixture/check.mjs";
import fast from "./fast/check.mjs";
import readable from "./readable/check.mjs";
import magicNumber from "./magic-number/check.mjs";
import readsOutput from "./reads-output/check.mjs";
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
  observable,
  conditional,
  isolated,
  controlled,
  specific,
  named,
  deterministic,
  oneThing,
  nameMatches,
  resilient,
  diagnostic,
  fixture,
  fast,
  readable,
  magicNumber,
  readsOutput,
  automated,
  restores,
  verdict,
];

/**
 * The checks that define a term in the rubric, in rubric order. The order goes
 * from what makes a guard (falsifiable, positive, runs) to the smells, and ends
 * with the type and the verdict. `asserts` and `name_matches` add no definition:
 * their criteria carry the meaning.
 */
const RUBRIC_ORDER = [
  canFail,
  positive,
  runs,
  observable,
  conditional,
  isolated,
  controlled,
  specific,
  named,
  resilient,
  diagnostic,
  fixture,
  fast,
  readable,
  magicNumber,
  readsOutput,
  automated,
  restores,
  deterministic,
  oneThing,
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
export const RUBRIC = [
  "Rubric for judging a test. Use these definitions for every question.",
  "",
  ...RUBRIC_ORDER.map((check) => {
    if (!check.rubric) throw new Error(`check ${check.name} has no rubric definition`);
    return check.rubric;
  }),
].join("\n");
