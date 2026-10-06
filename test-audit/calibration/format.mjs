// The calibration faces: a detailed table for one endpoint, a comparison matrix
// for several, and a per-test benchmark in markdown.

import { canFailText, escapeCell, pad } from "../report/index.mjs";
import { DESCRIPTIVE_KEYS, VERDICTS } from "../classifier/index.mjs";
import { rowStatus, shortStatus } from "./judge.mjs";

/** The detailed view for one endpoint and model. */
export function formatSingle(entry) {
  const { rows, verdict, usage, target } = entry;
  const lines = [`Live calibration: ${rows.length} cases, ${target.url} ${target.model}, ${usage.calls} calls, ${usage.tokens} tokens`, ""];
  lines.push([pad("CASE", 34), pad("DEFECT", 18), pad("WANT", 6), pad("CAN-FAIL", 9), pad("STATE", 11), pad("VERDICT", 13), pad("EYES", 5), "STATUS"].join(" "));
  for (const row of rows) {
    const result = row.result;
    lines.push(
      [
        pad(row.label.test, 34),
        pad(row.label.defect ?? "-", 18),
        pad(row.label.canFail === undefined ? "-" : row.label.canFail ? "yes" : "no", 6),
        pad(result ? canFailText(result.canFail) : "-", 9),
        pad(result ? result.canFail.state : row.error ?? "-", 11),
        pad(result ? result.score.label ?? "unclassified" : "-", 13),
        pad(result ? (result.needsEyes ? "yes" : "-") : "-", 5),
        rowStatus(row),
      ].join(" "),
    );
  }
  lines.push("");
  lines.push(summaryLine(verdict));
  lines.push(defectLine(verdict));
  lines.push(verdict.pass ? "Acceptance: PASS" : "Acceptance: FAIL");
  return lines.join("\n");
}

/** The comparison view: one status column per endpoint and model. */
export function formatMatrix(entries) {
  const width = 6;
  const lines = [`Live calibration: ${entries[0].rows.length} cases across ${entries.length} targets`, ""];
  lines.push([pad("CASE", 30), pad("DEFECT", 16), ...entries.map((entry, index) => pad(`T${index + 1}`, width))].join(" "));
  for (let row = 0; row < entries[0].rows.length; row++) {
    const cells = entries.map((entry) => shortStatus(entry.rows[row]));
    lines.push(
      [pad(entries[0].rows[row].label.test, 30), pad(entries[0].rows[row].label.defect ?? "-", 16), ...cells.map((cell) => pad(cell, width))].join(" "),
    );
  }
  lines.push("");
  lines.push(". ok   S silent pass   M mixed not routed   F false positive   W wrong can_fail   ? no test");
  lines.push("");
  for (let index = 0; index < entries.length; index++) {
    const { target, verdict, usage } = entries[index];
    lines.push(`T${index + 1} ${target.label}  [${target.url}]  ${usage.calls} calls`);
    lines.push(`   ${summaryLine(verdict)}`);
    lines.push(`   ${defectLine(verdict)}`);
    lines.push(`   ${verdict.pass ? "PASS" : "FAIL"}`);
  }
  return lines.join("\n");
}

/** The verdicts worst first, so an entry that needs attention appears early. */
const VERDICT_ORDER = [...VERDICTS, "unclassified"];

/**
 * The benchmark report: one entry per test, worst verdict first, with the result
 * of every check underneath and the reasons the test escalates. The checks come
 * from the battery, so a new question appears here without an edit.
 */
export function formatBenchmark(entries) {
  const lines = [];
  for (const entry of entries) {
    const { rows, verdict, usage, target } = entry;
    lines.push(`## ${target.label}`, "");
    lines.push(`Endpoint \`${target.url}\`. ${rows.length} cases, ${usage.calls} calls, ${usage.tokens} tokens.`);
    lines.push("");
    lines.push(summaryLine(verdict));
    lines.push("");
    lines.push(defectLine(verdict));
    lines.push("");
    lines.push(`Checks, in order: ${DESCRIPTIVE_KEYS.join(", ")}.`);
    lines.push("Each check is clean, the smell it looks for, or unanswered. `can_fail` is the mean P(can fail) over three phrasings; a `!` marks a spread above the band.");
    lines.push("");
    for (const row of [...rows].sort(byVerdict)) {
      lines.push(...testEntry(row), "");
    }
  }
  return lines.join("\n");
}

/** Worst verdict first, then by test name. */
function byVerdict(a, b) {
  const rank = (row) => VERDICT_ORDER.indexOf(row.result?.score.label ?? "unclassified");
  return rank(a) - rank(b) || a.label.test.localeCompare(b.label.test);
}

/** One test's entry: its defect, each check's result, then its verdict. */
function testEntry(row) {
  const { label, result, error } = row;
  const lines = [`### \`${escapeCell(label.test)}\` — ${label.defect ?? "unknown defect"}`, ""];
  if (!result) {
    lines.push(`No answer: ${escapeCell(error ?? "unknown")}.`, "", "**verdict: unclassified** · needs eyes: no answer", "");
    return lines;
  }
  lines.push(`- can_fail ${canFailText(result.canFail)} (spread ${result.canFail.spread === null ? "-" : result.canFail.spread.toFixed(2)}) · asserts ${result.asserts.value ?? "unclassified"} · runs ${yesNo(result.runs)}`);
  const clean = DESCRIPTIVE_KEYS.filter((key) => result.descriptive[key] === true);
  const smells = DESCRIPTIVE_KEYS.filter((key) => result.descriptive[key] === false);
  const unanswered = DESCRIPTIVE_KEYS.filter((key) => result.descriptive[key] === undefined);
  if (clean.length) lines.push(`- clean: ${clean.join(", ")}`);
  if (smells.length) lines.push(`- smells: ${smells.join(", ")}`);
  if (unanswered.length) lines.push(`- unanswered: ${unanswered.join(", ")}`);
  const eyes = result.needsEyes ? ` · needs eyes: ${result.reasons.join("; ")}` : "";
  lines.push(`- **verdict: ${result.score.label ?? "unclassified"}**${eyes}`);
  return lines;
}

/** @param {boolean | undefined} value */
function yesNo(value) {
  return value === true ? "yes" : value === false ? "no" : "unanswered";
}

/** @param {ReturnType<import("./judge.mjs").judge>} verdict */
function summaryLine(verdict) {
  return (
    `can_fail agreement: ${verdict.correct}/${verdict.resolved} resolved (${Math.round(verdict.agreement * 100)}%). ` +
    `Silent passes: ${verdict.silentPasses}. Mixed routed: ${verdict.mixedRouted}/${verdict.mixedTotal}. ` +
    `False positives: ${verdict.falsePositives}/${verdict.goodTotal}. ` +
    `deterministic: ${verdict.deterministicCorrect}/${verdict.deterministicTotal}.`
  );
}

/** Per-defect escalation, so a whole defect family that slips through shows. */
function defectLine(verdict) {
  const parts = Object.entries(verdict.defects)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([defect, group]) => `${defect} ${group.escalated}/${group.total}${group.escalated === group.total ? "" : "!"}`);
  return `defects escalated: ${parts.join(", ") || "none"}`;
}
