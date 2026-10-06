// The default face of an audit: a table, then the escalated tests with their
// reasons, then the summary.

import { eyesResults, location, pad, plural, rowCells, summary } from "./format.mjs";

/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").AuditUsage} AuditUsage */

/**
 * @param {AuditResult[]} results
 * @param {{ ref?: string, model?: string, usage?: AuditUsage }} [meta]
 */
export function formatText(results, meta = {}) {
  const lines = [];
  lines.push(`Audit of ${meta.ref ?? "the working tree"}: ${plural(results.length, "test")}`);
  lines.push("");
  const header = ["VERDICT", "EYES", "TYPE", "CAN-FAIL", "ASSERTS", "LOCATION", "NAME"];
  const widths = [8, 5, 14, 9, 16, 24, 0];
  lines.push(header.map((name, index) => pad(name, widths[index])).join(" "));
  for (const result of results) {
    lines.push(rowCells(result).map((cell, index) => pad(cell, widths[index])).join(" "));
    if (result.flags.length) lines.push(`${" ".repeat(8)}flags: ${result.flags.join(", ")}`);
  }

  const escalatedResults = eyesResults(results);
  if (escalatedResults.length) {
    lines.push("");
    lines.push("Needs eyes:");
    for (const result of escalatedResults) {
      lines.push(`  ${location(result.test)}  ${result.test.name}`);
      for (const reason of result.reasons) lines.push(`    - ${reason}`);
    }
  }

  lines.push("");
  lines.push(summary(results, meta));
  return lines.join("\n");
}
