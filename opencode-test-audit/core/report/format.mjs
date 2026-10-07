// canonical source: test-audit/report/format.mjs@c34fea8 sha256:8de1eb6bcb950d6db47ddaae9aadcda6642e90c3b3052b64959be24f40a912da - vendored copy, do not edit here
// The pieces the text and markdown reports share: how a can-fail value, a
// location, and the summary line read.

/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").AuditUsage} AuditUsage */

/** A can-fail value, with `!` when the paraphrase spread is above the band. @param {AuditResult["canFail"]} canFail */
export function canFailText(canFail) {
  if (!canFail || canFail.mean === null) return "-";
  return `${canFail.mean.toFixed(2)}${canFail.unstable ? "!" : ""}`;
}

/** `file:line` for one test. @param {AuditResult["test"]} test */
export function location(test) {
  return `${test.file}:${test.line}`;
}

/** The six result cells, in column order; each face renders them its own way. @param {AuditResult} result */
export function rowCells(result) {
  return [
    result.score.label ?? "unclassified",
    result.needsEyes ? "yes" : "-",
    canFailText(result.canFail),
    result.asserts ?? "unclassified",
    location(result.test),
    result.test.name,
  ];
}

/** "1 test", "2 tests": the noun agrees with the count. @param {number} count @param {string} noun */
export function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** "1 needs eyes", "2 need eyes": the verb agrees with the count. @param {number} eyes */
export function eyesPhrase(eyes) {
  return `${eyes} ${eyes === 1 ? "needs" : "need"} eyes`;
}

/** The tests that escalate, in input order. @param {AuditResult[]} results */
export function eyesResults(results) {
  return results.filter((result) => result.needsEyes);
}

/**
 * The closing line: counts by verdict, the unstable count, and the usage.
 * @param {AuditResult[]} results @param {{ usage?: AuditUsage }} meta
 */
export function summary(results, meta) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const result of results) {
    const label = result.score.label ?? "unclassified";
    counts[label] = (counts[label] ?? 0) + 1;
  }
  const parts = Object.entries(counts).map(([label, count]) => `${count} ${label}`);
  const eyes = eyesResults(results).length;
  const unstable = results.filter((result) => result.canFail?.unstable).length;
  const usage = meta.usage ? ` ${plural(meta.usage.calls, "call")}, ${meta.usage.tokens} tokens.` : "";
  return `Summary: ${parts.join(", ") || "no tests"}. ${unstable} unstable. ${eyesPhrase(eyes)}.${usage}`;
}

/** Pad to a column. A width of 0 or less means no cap and no padding. @param {string} text @param {number} width */
export function pad(text, width) {
  if (width <= 0) return text;
  const value = text.length > width ? `${text.slice(0, width - 1)}…` : text;
  return value.padEnd(width);
}

/**
 * Escape a markdown table cell: a pipe would break the table, a backtick would
 * break the code span around it, and a newline would break the row.
 * @param {string} text
 */
export function escapeCell(text) {
  return String(text).replaceAll("|", "\\|").replaceAll("`", "'").replaceAll("\n", " ");
}
