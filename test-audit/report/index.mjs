// The report: the text, json, and markdown faces of one audit, plus the exit
// code. Wording follows Simplified Technical English, like the rest of the repo.

export { formatText } from "./text.mjs";
export { formatJson } from "./json.mjs";
export { formatMarkdown } from "./markdown.mjs";
export { canFailText, pad } from "./format.mjs";

/** Exit 1 when any test escalates or any verdict is slop or weak. */
export function exitCode(results) {
  return results.some(escalated) ? 1 : 0;
}

/** @param {any} result */
function escalated(result) {
  return result.needsEyes || result.score.label === "slop" || result.score.label === "weak";
}
