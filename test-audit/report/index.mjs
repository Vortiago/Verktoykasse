// The report: the text, json, and markdown faces of one audit, plus the exit
// code. Wording follows Simplified Technical English, like the rest of the repo.

import { eyesResults } from "./format.mjs";
import { formatText } from "./text.mjs";
import { formatJson } from "./json.mjs";
import { formatMarkdown } from "./markdown.mjs";

export { formatText, formatJson, formatMarkdown };
export { canFailText, eyesResults, pad } from "./format.mjs";

/** Exit 1 when any test escalates. A slop or weak verdict always escalates. */
export function exitCode(results) {
  return eyesResults(results).length ? 1 : 0;
}

/**
 * The report for one audit, in one of the three faces. An empty change reads the
 * same in every face, so the CLI and the plugin say the same thing.
 * @param {{ results: any[], ref?: string, model?: string, usage?: object }} audit
 * @param {{ format?: "text" | "json" | "markdown" }} [opts]
 */
export function formatAudit(audit, opts = {}) {
  if (audit.results.length === 0) return "Test audit: no tests in the change.";
  const meta = { ref: audit.ref, model: audit.model, usage: audit.usage };
  if (opts.format === "json") return formatJson(audit.results, meta);
  if (opts.format === "markdown") return formatMarkdown(audit.results, meta);
  return formatText(audit.results, meta);
}