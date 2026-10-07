// canonical source: test-audit/classifier/finding.mjs@c2891f2 sha256:32793bcb697dc5d1061367d0f22da28faa0c79acf8892f7cdff3b908b13d7f9c - vendored copy, do not edit here
// The finding for one test: what an LLM should do with it, why, and how sure the
// tool is. The audit's reader is an LLM that decides which tests to look at, fix,
// or drop, so each finding is one action with its reasons.
//
// - drop: the test cannot guard anything. It cannot fail, it asserts nothing,
//   or its expected value comes from the code under test.
// - fix: the test runs a real check but a weak one, or it does not run.
// - look: the answers disagree, sit near a boundary, or are missing. The tool
//   is not sure, so the finding may be a false positive.
// - ok: nothing to report.
//
// A firm answer can still sit near 0.5 or near a verdict boundary. Then the
// finding is "unsure", so the reader knows it may be a false positive. A smell
// that makes a test unreliable (flaky, a state leak) turns an ok test into a
// fix, because the reader should act on it.

import { CHECKS } from "../checks/index.mjs";

/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").CheckResult} CheckResult */

/** @typedef {"drop" | "fix" | "look" | "ok"} Action */
/** @typedef {{ action: Action, reasons: string[], sure: boolean }} Finding */

/** A yes/no mean closer to 0.5 than this is not sure. */
const MARGIN = 0.25;

/** The assert kinds that drop the test, and the ones that need a fix, with their reason. */
const DROP_KINDS = { nothing: "asserts nothing", "from-code": "expected value comes from the code under test" };
const FIX_KINDS = {
  "shape-only": "asserts only the shape",
  "interaction-only": "asserts only a mock call",
  "input-only": "asserts its own input",
};

/** The flags that make a test unreliable, so the reader should fix it. */
const SMELLS = {
  "non-deterministic": "flaky",
  "order-dependent": "order-dependent",
  "state-leak": "leaks state",
  conditional: "conditional logic",
  manual: "needs a person",
  "focus-in-file": "a focus marker narrows the run",
  "structure-dependent": "reaches into internals",
};

/** The descriptive check that raises each flag, so a smell can say how sure it is. */
const SMELL_CHECKS = new Map(CHECKS.flatMap((check) => (check.role === "descriptive" ? [/** @type {const} */ ([check.flag, check])] : [])));

/**
 * @param {AuditResult} result
 * @returns {Finding}
 */
export function findingOf(result) {
  if (result.error) return { action: "look", reasons: [`no answer (${result.error})`], sure: false };
  const { can_fail: canFail, asserts, positive, runs } = result.checks;

  /** @type {Array<{ reason: string, sure: boolean }>} */
  const drop = [];
  /** @type {Array<{ reason: string, sure: boolean }>} */
  const fix = [];
  /** The check results whose reasons are firm findings, not doubts. */
  const firm = new Set();

  // "Cannot fail" beside a behaviour assertion is a contradiction, so a doubt.
  if (canFail?.value === false && asserts?.value !== "behaviour") {
    drop.push({ reason: "cannot fail", sure: wide(canFail) });
    firm.add(canFail);
  }
  if (typeof asserts?.value === "string" && asserts.value in DROP_KINDS) {
    drop.push({ reason: DROP_KINDS[/** @type {keyof typeof DROP_KINDS} */ (asserts.value)], sure: kindSure(result, asserts.value) });
    firm.add(asserts);
  }
  if (typeof asserts?.value === "string" && asserts.value in FIX_KINDS) {
    fix.push({ reason: FIX_KINDS[/** @type {keyof typeof FIX_KINDS} */ (asserts.value)], sure: kindSure(result, asserts.value) });
    firm.add(asserts);
  }
  if (runs?.value === false) {
    fix.push({ reason: "does not run, or a marker narrows the run", sure: wide(runs) });
    firm.add(runs);
  }
  if (positive?.value === false) {
    fix.push({ reason: "no positive assertion", sure: wide(positive) });
    firm.add(positive);
  }
  // Every other reason is a doubt: phrasings that disagree, a tie, a missing
  // answer, answers that contradict each other, or a file with no test the
  // extractor can read. They come from the result, so a reason that no check
  // owns still reaches the reader.
  const firmReasons = new Set([...firm].flatMap((check) => check.reasons));
  const doubts = result.reasons.filter((reason) => !firmReasons.has(reason));
  const smellFlags = result.flags.filter((flag) => flag in SMELLS);
  const smells = smellFlags.map((flag) => SMELLS[/** @type {keyof typeof SMELLS} */ (flag)]);

  if (drop.length) return { action: "drop", reasons: [...drop, ...fix].map((entry) => entry.reason).concat(smells), sure: drop.some((entry) => entry.sure) };
  if (fix.length) return { action: "fix", reasons: fix.map((entry) => entry.reason).concat(smells), sure: fix.some((entry) => entry.sure) };
  // A test that escalates is never ok, even when no reason above names it.
  if (doubts.length || result.needsEyes) return { action: "look", reasons: [...(doubts.length ? doubts : ["needs eyes"]), ...smells], sure: false };
  if (smells.length) return { action: "fix", reasons: smells, sure: smellFlags.some((flag) => smellSure(result, flag)) };
  return { action: "ok", reasons: [], sure: true };
}

/** A yes/no group whose mean sits well away from 0.5. @param {CheckResult} check */
function wide(check) {
  const mean = check.group?.mean;
  return typeof mean === "number" && Math.abs(mean - 0.5) >= MARGIN;
}

/**
 * A smell is sure when its answer sits well away from 0.5. A flag no question
 * raises, such as the extractor's focus-in-file, is a fact, so it is sure.
 * @param {AuditResult} result @param {string} flag
 */
function smellSure(result, flag) {
  const check = SMELL_CHECKS.get(flag);
  if (!check) return true;
  const value = result.answers[Object.keys(check.questions)[0]]?.noul;
  return typeof value === "number" && Math.abs(value - 0.5) >= MARGIN;
}

/**
 * Every asserts answer sits well away from 0.5, so the kind they give is sure.
 * @param {AuditResult} result @param {string} _kind
 */
function kindSure(result, _kind) {
  return Object.entries(result.answers)
    .filter(([key]) => key.startsWith("asserts_"))
    .every(([, answer]) => typeof answer.noul === "number" && Math.abs(answer.noul - 0.5) >= MARGIN);
}
