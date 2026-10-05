// The calibration faces: a detailed table for one endpoint, a comparison matrix
// for several, and a per-test benchmark in markdown.

import { canFailText, pad } from "../report/index.mjs";
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

/**
 * The benchmark report: for every test, the result of every check, in markdown.
 * A `+` is a clean answer, a `-` is the smell the check looks for, and a `.` is
 * an unanswered check. The verdict-carrying checks are can_fail and asserts; the
 * rest are descriptive.
 */
export function formatBenchmark(entries) {
  const lines = [`# test-audit benchmark`, ""];
  for (const entry of entries) {
    const { rows, verdict, usage, target } = entry;
    lines.push(`## ${target.label}`, "");
    lines.push(`Endpoint \`${target.url}\`. ${rows.length} cases, ${usage.calls} calls, ${usage.tokens} tokens.`);
    lines.push("");
    lines.push(summaryLine(verdict));
    lines.push("");
    lines.push(defectLine(verdict));
    lines.push("");
    lines.push("| Test | Defect | can_fail | spread | asserts | obs | cond | iso | ctl | spec | name | det | one | nm | verdict | eyes |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const row of rows) {
      const { label, result, error } = row;
      if (!result) {
        lines.push(`| ${md(label.test)} | ${label.defect ?? "-"} | ${md(error ?? "no answer")} | | | | | | | | | | | | | |`);
        continue;
      }
      const d = result.descriptive;
      lines.push(
        `| ${md(label.test)} | ${label.defect ?? "-"} | ${canFailText(result.canFail)} | ${result.canFail.spread === null ? "-" : result.canFail.spread.toFixed(2)} | ${result.asserts.value ?? "unclassified"} | ${checkSymbol(d.observable)} | ${checkSymbol(d.conditional)} | ${checkSymbol(d.isolated)} | ${checkSymbol(d.controlled)} | ${checkSymbol(d.specific)} | ${checkSymbol(d.named)} | ${checkSymbol(d.deterministic)} | ${checkSymbol(d.one_thing)} | ${checkSymbol(d.name_matches)} | ${result.score.label ?? "unclassified"} | ${result.needsEyes ? "yes" : "-"} |`,
      );
    }
    const eyes = rows.filter((row) => row.needsEyes);
    if (eyes.length) {
      lines.push("");
      lines.push("Needs eyes:");
      for (const row of eyes) lines.push(`- \`${row.label.test}\` (${row.label.defect ?? "-"}): ${row.reasons.join("; ")}`);
    }
    lines.push("");
  }
  lines.push("Legend: `+` clean, `-` the smell the check looks for, `.` unanswered. `can_fail` is the mean P(can fail) over three phrasings; `spread` above the band is instability. `obs` observable, `cond` conditional, `iso` isolated, `ctl` controlled, `spec` specific, `name` named, `det` deterministic, `one` one behaviour, `nm` name matches body.");
  return lines.join("\n");
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

/** A check result as one markdown-safe mark. */
function checkSymbol(value) {
  if (value === true) return "+";
  if (value === false) return "-";
  return ".";
}

/** Escape a pipe so a test name cannot break the table. */
function md(text) {
  return String(text).replaceAll("|", "\\|");
}
