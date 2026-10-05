// The default face of an audit: a table, then the escalated tests with their
// reasons, then the summary.

import { canFailText, eyesResults, location, pad, summary } from "./format.mjs";

/**
 * @param {any[]} results
 * @param {{ ref?: string, model?: string, usage?: { calls: number, tokens: number } }} [meta]
 */
export function formatText(results, meta = {}) {
  const lines = [];
  lines.push(`Audit of ${meta.ref ?? "the working tree"}: ${results.length} test${results.length === 1 ? "" : "s"}`);
  lines.push("");
  const header = ["VERDICT", "EYES", "TYPE", "CAN-FAIL", "ASSERTS", "LOCATION", "NAME"];
  const widths = [8, 5, 14, 9, 16, 24, 0];
  lines.push(header.map((name, index) => pad(name, widths[index])).join(" "));
  for (const result of results) {
    const cells = [
      result.score.label ?? "unclassified",
      result.needsEyes ? "yes" : "-",
      result.type ?? "unclassified",
      canFailText(result.canFail),
      result.asserts.value ?? "unclassified",
      location(result.test),
      result.test.name,
    ];
    lines.push(cells.map((cell, index) => pad(cell, widths[index])).join(" "));
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
