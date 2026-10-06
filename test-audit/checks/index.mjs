// The checks: one folder for each judgement the tool asks the model about a test.
// Each `<check>/check.mjs` holds the check's questions, its rubric definition,
// its role in the verdict, and its sources. Its `cases/` folder holds the
// calibration cases meant to catch it.
//
// This module puts the checks together. It builds the battery (every question,
// in one call), the shared rubric, and the tables the verdict rules read. The
// questions are data. The rules over their answers are in classifier/verdict.mjs.

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

/** The twin gates, in the order their escalation reasons are listed. */
const GATE_ORDER = [runs, positive];

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

/** The `verdict` score levels, lowest first. `.score` is their array index. */
export const VERDICTS = only("verdict").levels;

/** The phrasings of "can this test fail". */
export const CAN_FAIL_KEYS = Object.keys(only("can-fail").questions);

/** The phrasings whose yes and no are swapped. Normalisation flips their value. */
export const NEGATED = new Set(CHECKS.flatMap((check) => check.negated ?? []));

/** The one assert kind that is a real guard. Every other kind escalates. */
export const ASSERT_PASS = Object.keys(only("asserts").kinds)[0];

/**
 * The verdict-carrying yes/no gates. Each is asked as a twin pair, one of them
 * negated, so one confident wrong answer cannot pass a test alone (ADR 0007).
 * `reason` is the escalation a false answer raises.
 * @type {Record<string, { keys: string[], reason: string }>}
 */
export const ESCALATE_ON_FALSE = {};
for (const check of GATE_ORDER) {
  if (check.role !== "gate") throw new Error(`check ${check.name} is not a gate`);
  ESCALATE_ON_FALSE[check.name] = { keys: Object.keys(check.questions), reason: check.reason };
}

/**
 * The flag a false answer to each descriptive question raises, keyed by the
 * question's name.
 * @type {Record<string, string>}
 */
export const FLAG_BY_GATE = {};
for (const check of CHECKS) {
  if (check.role === "descriptive") for (const key of Object.keys(check.questions)) FLAG_BY_GATE[key] = check.flag;
}

/** The descriptive questions, in report order. */
export const DESCRIPTIVE_KEYS = Object.keys(FLAG_BY_GATE);

/**
 * The one check with a role. The roles `can-fail`, `asserts` and `verdict` each
 * belong to exactly one check.
 * @template {"can-fail" | "asserts" | "verdict"} Role
 * @param {Role} role
 * @returns {Extract<Check, { role: Role }>}
 */
function only(role) {
  const found = CHECKS.filter((check) => check.role === role);
  if (found.length !== 1) throw new Error(`${found.length} checks have the role ${role}, not 1`);
  return /** @type {Extract<Check, { role: Role }>} */ (found[0]);
}
