// Rendering and exit codes for an audit. Text is the default; `--json` emits
// the full record and `--markdown` emits a review comment. Wording follows
// Simplified Technical English, like the rest of the repo.

/** Exit 1 when any test escalates or any verdict is slop or weak. */
export function exitCode(results) {
  return results.some(escalated) ? 1 : 0;
}

/** @param {any} result */
function escalated(result) {
  return result.needsEyes || result.score.label === "slop" || result.score.label === "weak";
}

/**
 * The default table, then the escalated tests with their reasons, then the
 * summary.
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

  const escalatedResults = results.filter((result) => result.needsEyes);
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

/**
 * The full record: answers, probabilities, masses and all.
 * @param {any[]} results
 * @param {{ ref?: string, model?: string, usage?: object }} [meta]
 */
export function formatJson(results, meta = {}) {
  return JSON.stringify({ ref: meta.ref, model: meta.model, usage: meta.usage, results }, null, 2);
}

/**
 * A markdown table and the escalation list, for a review comment.
 * @param {any[]} results
 * @param {{ ref?: string, model?: string, usage?: object }} [meta]
 */
export function formatMarkdown(results, meta = {}) {
  const lines = [];
  lines.push(`## Test audit: ${meta.ref ?? "the working tree"}`);
  lines.push("");
  lines.push(`${results.length} test${results.length === 1 ? "" : "s"}, ${eyesPhrase(results.filter((r) => r.needsEyes).length)}.`);
  lines.push("");
  lines.push("| Verdict | Eyes | Type | Can fail | Asserts | Test |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const result of results) {
    lines.push(
      `| ${result.score.label ?? "unclassified"} | ${result.needsEyes ? "yes" : "-"} | ${result.type ?? "unclassified"} | ${canFailText(result.canFail)} | ${result.asserts.value ?? "unclassified"} | \`${location(result.test)}\` ${result.test.name} |`,
    );
  }
  const escalatedResults = results.filter((result) => result.needsEyes);
  if (escalatedResults.length) {
    lines.push("");
    lines.push("### Needs eyes");
    for (const result of escalatedResults) {
      lines.push(`- \`${location(result.test)}\` ${result.test.name}: ${result.reasons.join("; ")}`);
    }
  }
  lines.push("");
  lines.push(summary(results, meta));
  return lines.join("\n");
}

/** @param {any[]} results @param {object} meta */
function summary(results, meta) {
  const counts = {};
  for (const result of results) {
    const label = result.score.label ?? "unclassified";
    counts[label] = (counts[label] ?? 0) + 1;
  }
  const parts = Object.entries(counts).map(([label, count]) => `${count} ${label}`);
  const eyes = results.filter((result) => result.needsEyes).length;
  const unstable = results.filter((result) => result.canFail.state === "unstable" || result.canFail.state === "borderline").length;
  const usage = meta.usage ? ` ${meta.usage.calls} call${meta.usage.calls === 1 ? "" : "s"}, ${meta.usage.tokens} tokens.` : "";
  return `Summary: ${parts.join(", ") || "no tests"}. ${unstable} unstable. ${eyesPhrase(eyes)}.${usage}`;
}

/** "1 needs eyes", "2 need eyes": the verb agrees with the count. */
function eyesPhrase(eyes) {
  return `${eyes} ${eyes === 1 ? "needs" : "need"} eyes`;
}

/** @param {any} canFail */
export function canFailText(canFail) {
  if (canFail.mean === null) return "-";
  return `${canFail.mean.toFixed(2)}${canFail.state === "stable" ? "" : "!"}`;
}

/** @param {{ file: string, line: number }} test */
function location(test) {
  return `${test.file}:${test.line}`;
}

/** @param {string} text @param {number} width */
export function pad(text, width) {
  const value = text.length > width ? `${text.slice(0, width - 1)}…` : text;
  return value.padEnd(width);
}

