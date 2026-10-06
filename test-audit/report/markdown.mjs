// The review-comment face of an audit: a markdown table and the escalation list.

import { escapeCell, eyesPhrase, eyesResults, location, rowCells, summary } from "./format.mjs";

/**
 * @param {any[]} results
 * @param {{ ref?: string, model?: string, usage?: object }} [meta]
 */
export function formatMarkdown(results, meta = {}) {
  const lines = [];
  lines.push(`## Test audit: ${meta.ref ?? "the working tree"}`);
  lines.push("");
  lines.push(`${results.length} test${results.length === 1 ? "" : "s"}, ${eyesPhrase(eyesResults(results).length)}.`);
  lines.push("");
  lines.push("| Verdict | Eyes | Type | Can fail | Asserts | Test |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const result of results) {
    const [verdict, eyes, type, canFail, asserts, where, name] = rowCells(result);
    lines.push(`| ${verdict} | ${eyes} | ${type} | ${canFail} | ${asserts} | \`${escapeCell(where)}\` ${escapeCell(name)} |`);
  }
  const escalatedResults = eyesResults(results);
  if (escalatedResults.length) {
    lines.push("");
    lines.push("### Needs eyes");
    for (const result of escalatedResults) {
      lines.push(`- \`${escapeCell(location(result.test))}\` ${escapeCell(result.test.name)}: ${result.reasons.join("; ")}`);
    }
  }
  lines.push("");
  lines.push(summary(results, meta));
  return lines.join("\n");
}
