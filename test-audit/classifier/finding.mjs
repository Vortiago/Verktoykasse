// The finding for one test: what an LLM should do with it, why, and how sure the
// tool is. The audit's reader is an LLM that decides which tests to look at, fix,
// or drop, so each finding is one action with its reasons.
//
// - drop: the test cannot guard anything. It cannot fail, or its expected
//   value and its result come from the same code.
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

/** The flags that make a test unreliable, so the reader should fix it. */
const SMELLS = {
  "non-deterministic": "flaky",
  "order-dependent": "order-dependent",
  "state-leak": "leaks state",
  conditional: "conditional logic",
  manual: "needs a person",
  "structure-dependent": "reaches into internals",
};

/** The descriptive check that raises each flag, so a smell can say how sure it is. */
const SMELL_CHECKS = new Map(CHECKS.flatMap((check) => (check.role === "descriptive" ? [/** @type {const} */ ([check.flag, check.name])] : [])));

/** The asserts check, whose kinds give each assertion kind its level and reason. */
const ASSERTS = CHECKS.find((check) => check.role === "asserts");

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
  /** @param {typeof drop} list @param {CheckResult} check @param {string} reason */
  const add = (list, check, reason) => {
    list.push({ reason, sure: check.sure });
    firm.add(check);
  };

  // "Cannot fail" beside a behaviour assertion is a contradiction, so a doubt.
  if (canFail?.value === false && asserts?.value !== "behaviour") add(drop, canFail, "cannot fail");
  const kind = typeof asserts?.value === "string" && ASSERTS?.role === "asserts" ? ASSERTS.kinds[asserts.value] : undefined;
  if (asserts && kind?.reason) add(kind.level === "slop" ? drop : fix, asserts, kind.reason);
  if (runs?.value === false) add(fix, runs, "does not run, or a marker narrows the run");
  if (positive?.value === false) add(fix, positive, "no positive assertion");

  // Every other reason is a doubt: phrasings that disagree, a tie, a missing
  // answer, answers that contradict each other, or a file with no test the
  // extractor can read. They come from the result, so a reason that no check
  // owns still reaches the reader.
  const firmReasons = new Set([...firm].flatMap((check) => check.reasons));
  const doubts = result.reasons.filter((reason) => !firmReasons.has(reason));
  const smellFlags = result.flags.filter((flag) => flag in SMELLS);
  const smells = smellFlags.map((flag) => SMELLS[/** @type {keyof typeof SMELLS} */ (flag)]);
  // A smell is as sure as the answer behind it.
  const smellSure = smellFlags.some((flag) => result.checks[SMELL_CHECKS.get(flag) ?? ""]?.sure);

  if (drop.length) return { action: "drop", reasons: [...drop, ...fix].map((entry) => entry.reason).concat(smells), sure: drop.some((entry) => entry.sure) };
  if (fix.length) return { action: "fix", reasons: fix.map((entry) => entry.reason).concat(smells), sure: fix.some((entry) => entry.sure) };
  // A test that escalates is never ok, even when no reason above names it.
  if (doubts.length || result.needsEyes) return { action: "look", reasons: [...(doubts.length ? doubts : ["needs eyes"]), ...smells], sure: false };
  if (smells.length) return { action: "fix", reasons: smells, sure: smellSure };
  return { action: "ok", reasons: [], sure: true };
}
