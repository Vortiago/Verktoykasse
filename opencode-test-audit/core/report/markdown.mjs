// canonical source: test-audit/report/markdown.mjs@4ba9d42 sha256:cd320dd13f0ed051958db17e23032bc0f9bd6a7cad4286d44df546bcf825102a - vendored copy, do not edit here
// The review-comment face of an audit: a markdown table and the escalation list.

import { escapeCell, eyesPhrase, eyesResults, location, plural, rowCells, summary } from "./format.mjs";

/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").AuditUsage} AuditUsage */

/**
 * @param {AuditResult[]} results
 * @param {{ ref?: string, model?: string, usage?: AuditUsage }} [meta]
 */
export function formatMarkdown(results, meta = {}) {
  const escalatedResults = eyesResults(results);
  const lines = [];
  lines.push(`## Test audit: ${meta.ref ?? "the working tree"}`);
  lines.push("");
  lines.push(`${plural(results.length, "test")}, ${eyesPhrase(escalatedResults.length)}.`);
  lines.push("");
  lines.push("| Verdict | Eyes | Type | Can fail | Asserts | Test |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const result of results) {
    const [verdict, eyes, type, canFail, asserts, where, name] = rowCells(result);
    lines.push(`| ${verdict} | ${eyes} | ${type} | ${canFail} | ${asserts} | \`${escapeCell(where)}\` ${escapeCell(name)} |`);
  }
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
