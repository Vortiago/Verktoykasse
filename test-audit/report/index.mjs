// The report: the text, json, and markdown faces of one audit, plus the exit
// code. Wording follows Simplified Technical English, like the rest of the repo.

import { eyesResults } from "./format.mjs";
import { formatText } from "./text.mjs";
import { formatMarkdown } from "./markdown.mjs";

export { formatText, formatMarkdown };
export { canFailText, escapeCell, pad } from "./format.mjs";

/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").AuditUsage} AuditUsage */

/**
 * Exit 2 when a call failed, so a script can tell an unreachable endpoint from a
 * test that needs eyes; else 1 when any test escalates (a slop or weak verdict
 * always does); else 0. The failed test still escalates in the report.
 * @param {AuditResult[]} results
 */
export function exitCode(results) {
  if (results.some((result) => result.error)) return 2;
  return eyesResults(results).length ? 1 : 0;
}

/**
 * The report for one audit, in one of the three faces. An empty change reads the
 * same in the text and markdown faces; the json face always emits a record, so a
 * script that parses it never meets prose.
 * @param {{ results: AuditResult[], ref?: string, model?: string, usage?: AuditUsage }} audit
 * @param {{ format?: "text" | "json" | "markdown" }} [opts]
 */
export function formatAudit(audit, opts = {}) {
  const meta = { ref: audit.ref, model: audit.model, usage: audit.usage };
  if (opts.format === "json") return JSON.stringify({ ...meta, results: audit.results }, null, 2);
  if (audit.results.length === 0) return "Test audit: no tests in the change.";
  if (opts.format === "markdown") return formatMarkdown(audit.results, meta);
  return formatText(audit.results, meta);
}