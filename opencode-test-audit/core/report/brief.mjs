// canonical source: test-audit/report/brief.mjs@68e72cd sha256:daee96d52bbd5e0e7f2fb28a7e2a71a0a5a50ebe9db57b8c0dbc4b7249764f75 - vendored copy, do not edit here
// The brief face: one line per test that needs an action, for an LLM to read.
// Each line names the action, the place, the test, the reasons, and how sure the
// tool is. An ok test gets no line. The worst actions come first.

import { findingOf } from "../classifier/finding.mjs";
import { location, plural } from "./format.mjs";

/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").AuditUsage} AuditUsage */

/** The order of the lines, and of the counts in the summary. */
const ACTIONS = ["drop", "fix", "look", "ok"];

/**
 * @param {AuditResult[]} results
 * @param {{ usage?: AuditUsage }} [meta]
 */
export function formatBrief(results, meta = {}) {
  const found = results.map((result) => ({ result, finding: findingOf(result) }));
  const lines = ACTIONS.slice(0, -1).flatMap((action) =>
    found
      .filter(({ finding }) => finding.action === action)
      .map(({ result, finding }) => {
        const certainty = finding.sure ? "sure" : "unsure, possibly a false positive";
        return `${action}  ${location(result.test)}  ${JSON.stringify(result.test.name)}  ${finding.reasons.join("; ")}  (${certainty})`;
      }),
  );
  const counts = ACTIONS.map((action) => [action, found.filter(({ finding }) => finding.action === action).length])
    .filter(([, count]) => count)
    .map(([action, count]) => `${count} ${action}`);
  const usage = meta.usage ? ` ${plural(meta.usage.calls, "call")}, ${meta.usage.tokens} tokens.` : "";
  lines.push(`${plural(results.length, "test")}: ${counts.join(", ")}.${usage}`);
  return lines.join("\n");
}
