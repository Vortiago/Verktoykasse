// canonical source: test-audit/report/brief.mjs@cc13b61 sha256:3811cfbbb3900a217c11ba84ae047d6f6ea2bcdca37f15dc6b2e22e186d1d310 - vendored copy, do not edit here
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
        // A test the endpoint never answered is not judged, so it is no false positive either.
        const certainty = result.error ? "not judged" : finding.sure ? "sure" : "unsure, possibly a false positive";
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
