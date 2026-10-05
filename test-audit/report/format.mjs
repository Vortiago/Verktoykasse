// The pieces the text and markdown reports share: how a can-fail value, a
// location, and the summary line read.

/** A can-fail value, with `!` when the paraphrase spread was not stable. */
export function canFailText(canFail) {
  if (canFail.mean === null) return "-";
  return `${canFail.mean.toFixed(2)}${canFail.state === "stable" ? "" : "!"}`;
}

/** `file:line` for one test. */
export function location(test) {
  return `${test.file}:${test.line}`;
}

/** "1 needs eyes", "2 need eyes": the verb agrees with the count. */
export function eyesPhrase(eyes) {
  return `${eyes} ${eyes === 1 ? "needs" : "need"} eyes`;
}

/** The tests that escalate, in input order. */
export function eyesResults(results) {
  return results.filter((result) => result.needsEyes);
}

/** The closing line: counts by verdict, the unstable count, and the usage. */
export function summary(results, meta) {
  const counts = {};
  for (const result of results) {
    const label = result.score.label ?? "unclassified";
    counts[label] = (counts[label] ?? 0) + 1;
  }
  const parts = Object.entries(counts).map(([label, count]) => `${count} ${label}`);
  const eyes = eyesResults(results).length;
  const unstable = results.filter((result) => result.canFail.state === "unstable" || result.canFail.state === "borderline").length;
  const usage = meta.usage ? ` ${meta.usage.calls} call${meta.usage.calls === 1 ? "" : "s"}, ${meta.usage.tokens} tokens.` : "";
  return `Summary: ${parts.join(", ") || "no tests"}. ${unstable} unstable. ${eyesPhrase(eyes)}.${usage}`;
}

/** Pad to a column, with an ellipsis when the text is too long. */
export function pad(text, width) {
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
