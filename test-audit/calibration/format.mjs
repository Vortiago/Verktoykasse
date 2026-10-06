// The calibration faces: a detailed table for one endpoint, a comparison matrix
// for several, and a per-case benchmark in markdown.

import { canFailText, escapeCell, pad } from "../report/index.mjs";
import { ASSERT_PASS, BATTERY, CAN_FAIL_KEYS, CAN_FAIL_NEGATED, ESCALATE_ON_FALSE, FLAG_BY_GATE, trusted } from "../classifier/index.mjs";
import { rowStatus, saidCanFail, shortStatus } from "./judge.mjs";

/** @typedef {import("../types.d.ts").AuditUsage} AuditUsage */
/** @typedef {import("../types.d.ts").AuditAnswer} AuditAnswer */
/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").CalibrationLabel} CalibrationLabel */
/** @typedef {import("../types.d.ts").CalibrationRow} CalibrationRow */
/** @typedef {import("../classifier/systemone.mjs").Question} Question */
/** @typedef {ReturnType<typeof import("./judge.mjs").judge>} Judgement */
/**
 * One endpoint and model's run over the corpus. `missing` names the questions
 * whose answers the record does not hold, such as a run recorded by an older
 * version of the tool; the benchmark prints "not recorded" for them.
 * @typedef {{ target: { url: string, model: string }, rows: CalibrationRow[], verdict: Judgement, usage: AuditUsage, missing?: string[] }} CalibrationEntry
 */

/** The detailed view for one endpoint and model. @param {CalibrationEntry} entry */
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

/** The comparison view: one status column per endpoint and model. @param {CalibrationEntry[]} entries */
export function formatMatrix(entries) {
  const width = 6;
  const lines = [`Live calibration: ${entries[0].rows.length} cases across ${entries.length} targets`, ""];
  lines.push([pad("CASE", 30), pad("DEFECT", 16), ...entries.map((_entry, index) => pad(`T${index + 1}`, width))].join(" "));
  for (let row = 0; row < entries[0].rows.length; row++) {
    const cells = entries.map((entry) => shortStatus(entry.rows[row]));
    lines.push(
      [pad(entries[0].rows[row].label.test, 30), pad(entries[0].rows[row].label.defect ?? "-", 16), ...cells.map((cell) => pad(cell, width))].join(" "),
    );
  }
  lines.push("");
  lines.push(". ok   S silent pass   M mixed not routed   F false positive   W wrong can_fail   E no answer   ? no test");
  lines.push("");
  for (let index = 0; index < entries.length; index++) {
    const { target, verdict, usage } = entries[index];
    lines.push(`T${index + 1} ${target.model}  [${target.url}]  ${usage.calls} calls`);
    lines.push(`   ${summaryLine(verdict)}`);
    lines.push(`   ${defectLine(verdict)}`);
    lines.push(`   ${verdict.pass ? "PASS" : "FAIL"}`);
  }
  return lines.join("\n");
}

/** Each row status, in the words the benchmark uses. Keyed by `rowStatus`.
 * @type {Record<string, { name: string, meaning: string }>} */
const STATUS = {
  ok: { name: "OK", meaning: "the outcome matches the label." },
  SILENT: { name: "SILENT pass", meaning: "a defect case did not escalate. Acceptance fails." },
  MIXED: { name: "MIXED not routed", meaning: "a mixed case did not escalate. Acceptance fails." },
  "FALSE+": { name: "FALSE positive", meaning: "a case that should pass escalated." },
  WRONG: { name: "WRONG can_fail", meaning: "the tool committed to the wrong can_fail value." },
  ERROR: { name: "NO ANSWER", meaning: "the endpoint gave no trusted answer. Acceptance fails." },
  "no-test": { name: "NO TEST", meaning: "the case file holds no test with this name. Acceptance fails." },
};

/** The paraphrase pair for the assertion target. */
const ASSERTS_KEYS = ["asserts_a", "asserts_b"];
/** The verdict-carrying questions, in the order a reader checks them. */
const VERDICT_KEYS = [...CAN_FAIL_KEYS, ...ASSERTS_KEYS, ...Object.keys(ESCALATE_ON_FALSE), "verdict"];
/** Every other question, in battery order: `type`, the descriptive questions, and any new one. */
const OTHER_KEYS = Object.keys(BATTERY).filter((key) => !VERDICT_KEYS.includes(key));
/** The label fields the "known defect" paragraph states in its own words. */
const LABEL_KEYS = new Set(["file", "test", "defect", "canFail", "mustEscalate", "mixed", "note", "group", "sources"]);

/**
 * The benchmark report in markdown. A summary for each target comes first: the
 * headline numbers, one row for each defect family, and links to the cases that
 * are not OK. A legend explains the terms once. Then one section for each case:
 * the test source, its label, every question with its answer, and the outcome.
 * The questions come from the battery, so a new question appears without an edit.
 * @param {CalibrationEntry[]} entries
 * @param {{ preamble?: string[] }} [opts] markdown lines that go under the title, such as the date and the command
 */
export function formatBenchmark(entries, opts = {}) {
  const lines = ["# test-audit benchmark", ""];
  if (opts.preamble?.length) lines.push(...opts.preamble, "");
  lines.push(
    "This file records a calibration run of `test-audit` over the labelled corpus. Each case is one test with a known defect, or a clean test. The legend under the summary explains the terms.",
    "",
  );
  const prefix = (/** @type {number} */ index) => (entries.length > 1 ? `t${index + 1}-` : "");
  entries.forEach((entry, index) => lines.push(...summarySection(entry, prefix(index)), ""));
  lines.push(...legend(), "");
  entries.forEach((entry, index) => lines.push(...casesSection(entry, prefix(index))));
  return lines.join("\n").trimEnd();
}

/** The rows in report order: by defect family, then by test name. @param {CalibrationRow[]} rows */
function orderedRows(rows) {
  return [...rows].sort((a, b) => family(a).localeCompare(family(b)) || a.label.test.localeCompare(b.label.test));
}

/** @param {CalibrationRow} row */
function family(row) {
  return row.label.defect ?? "other";
}

/** @param {CalibrationRow} row */
function statusName(row) {
  const status = rowStatus(row);
  return STATUS[status]?.name ?? status;
}

/** The headline numbers, the defect families, and the index of the cases that are not OK. @param {CalibrationEntry} entry @param {string} prefix */
function summarySection(entry, prefix) {
  const { target, rows, verdict, usage } = entry;
  const percent = (/** @type {number} */ share) => `${Math.round(share * 100)}%`;
  const lines = [`## Summary: ${target.model}`, ""];
  lines.push(`Endpoint ${code(target.url)}, model ${code(target.model)}. ${rows.length} cases, ${usage.calls} calls, ${usage.tokens} tokens.`, "");
  lines.push("| Measure | Result | Meaning |", "| --- | --- | --- |");
  lines.push(`| Cases | ${rows.length} | The labelled tests in the corpus. |`);
  lines.push(`| Silent passes | ${verdict.silentPasses} | Defect cases that did not escalate. Must be 0. |`);
  lines.push(`| False positives | ${verdict.falsePositives} of ${verdict.goodTotal} | Cases that should pass, but escalated. Lower is better. |`);
  lines.push(
    `| can_fail agreement | ${verdict.correct} of ${verdict.resolved} (${percent(verdict.agreement)}) | The can_fail answers that match the label. Only the cases where the tool committed to a value count. Must be ${percent(verdict.minAgreement)} or more. |`,
  );
  lines.push(`| Mixed routed | ${verdict.mixedRouted} of ${verdict.mixedTotal} | Mixed cases that escalated. Must be all. |`);
  lines.push(`| deterministic agreement | ${verdict.deterministicCorrect} of ${verdict.deterministicTotal} | The deterministic answers that match the label. Not an acceptance rule. |`);
  lines.push(`| Unresolved | ${verdict.unresolved} | Cases with no test or no answer. Must be 0. |`);
  lines.push(`| Acceptance | **${verdict.pass ? "PASS" : "FAIL"}** | PASS when each "must" in this table holds. |`);

  lines.push("", "### Defect families", "", "| Family | Cases | Escalated | Expected | OK |", "| --- | --- | --- | --- | --- |");
  /** @type {Map<string, CalibrationRow[]>} */
  const families = new Map();
  for (const row of orderedRows(rows)) families.set(family(row), [...(families.get(family(row)) ?? []), row]);
  for (const [name, group] of families) {
    const escalated = group.filter((row) => row.result?.needsEyes).length;
    const bad = group.filter((row) => rowStatus(row) !== "ok");
    const ok = bad.length ? `**no**: ${countText(bad.map(statusName))}` : "yes";
    lines.push(`| ${escapeCell(name)} | ${group.length} | ${escalated} | ${expectedText(group.map((row) => row.label))} | ${ok} |`);
  }

  const numbered = orderedRows(rows).map((row, index) => ({ row, number: index + 1 }));
  const notOk = numbered.filter(({ row }) => rowStatus(row) !== "ok");
  const links = notOk.map(({ row, number }) => `[${number}. ${code(row.label.test)}](#${prefix}case-${number}) ${statusName(row)}`);
  lines.push("", notOk.length ? `**Not OK:** ${links.join(" · ")}.` : "**Not OK:** none. Each case matches its label.");
  return lines;
}

/** What a family of labels expects: escalate, pass, either, or a count of each. @param {CalibrationLabel[]} labels */
function expectedText(labels) {
  const counts = [
    [labels.filter((label) => label.mustEscalate === true).length, "escalate"],
    [labels.filter((label) => label.mustEscalate === false).length, "pass"],
    [labels.filter((label) => label.mustEscalate === undefined).length, "either"],
  ].filter(([count]) => count);
  if (counts.length === 1) return String(counts[0][1]);
  return counts.map(([count, word]) => `${count} ${word}`).join(", ");
}

/** "2 FALSE positive, 1 WRONG can_fail". @param {string[]} names */
function countText(names) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => `${count} ${name}`).join(", ");
}

/** The terms, explained once. */
function legend() {
  const levels = levelsOf(BATTERY.verdict);
  return [
    "## Legend",
    "",
    "- **Case**: one labelled test in `calibration/cases/`. Its **label** in `calibration/labels/` states the known defect and the expected outcome.",
    "- **Escalate**: the tool sends the test to a human. The test then **needs eyes**. Each **reason** says why.",
    "- **Verdict-carrying question**: a question whose answer can escalate the test.",
    '- **Descriptive question**: a question whose "no" raises a **flag**. A flag describes the test. It does not escalate the test.',
    `- **can_fail**: the probability that a change to the code under test can make the test fail. The tool asks it three ways (${CAN_FAIL_KEYS.map(code).join(", ")}) and takes the mean. ${[...CAN_FAIL_NEGATED].map(code).join(", ")} asks the opposite, so its "no" means "can fail".`,
    "- **Spread**: the highest minus the lowest of the three can_fail values. A spread above `TEST_AUDIT_STABLE_BAND` makes the value unstable, and the test escalates. A `!` after a can_fail value marks this.",
    `- **asserts**: what the assertion checks. Only ${code(ASSERT_PASS)} is a real guard. ${ASSERTS_KEYS.map(code).join(" and ")} give the options in opposite order, and must agree.`,
    `- **Answer**: for a yes/no question, the number in brackets is the probability of yes. For a choice, it is the probability of the chosen option. For the verdict, it is the score from 0 (${levels[0]}) to ${levels.length - 1} (${levels[levels.length - 1]}).`,
    "- **not recorded**: the run did not record this value. **unanswered**: the endpoint gave no answer. **untrusted**: the answer has a `mass` below `TEST_AUDIT_MIN_MASS`.",
    "- **Status** of a case:",
    ...Object.values(STATUS).map((status) => `  - **${status.name}**: ${status.meaning}`),
  ];
}

/** One section for each case, in report order. @param {CalibrationEntry} entry @param {string} prefix */
function casesSection(entry, prefix) {
  const missing = new Set(entry.missing ?? []);
  const lines = [`## Cases: ${entry.target.model}`, ""];
  orderedRows(entry.rows).forEach((row, index) => lines.push(...caseSection(row, index + 1, prefix, missing), ""));
  return lines;
}

/**
 * One case: the test, its label, the questions, and the outcome.
 * @param {CalibrationRow} row @param {number} number @param {string} prefix @param {Set<string>} missing
 */
function caseSection(row, number, prefix, missing) {
  const { label, test, result } = row;
  const lines = [`<a id="${prefix}case-${number}"></a>`, "", `### ${number}. ${code(label.test)}: ${statusName(row)}`, ""];
  const where = test ? `, line ${test.line}` : "";
  const group = label.group ? ` Label group: ${code(label.group)}.` : "";
  lines.push(`Case file: [${code(`calibration/${label.file}`)}](calibration/${label.file})${where}.${group}`, "");
  if (test) {
    if (test.scope?.length) lines.push(`Inside: ${test.scope.map(code).join(" > ")}`, "");
    lines.push(...fenced(test.source, languageOf(label.file)), "");
    if (test.fixtures?.length) lines.push("Fixtures:", "", ...fenced(test.fixtures.join("\n\n"), languageOf(label.file)), "");
    if (test.flags?.length) lines.push(`Extractor notes: ${test.flags.map(code).join(", ")}.`, "");
  } else {
    lines.push(`No test source: ${row.error ?? "the case file holds no test with this name"}.`, "");
  }
  lines.push(...knownDefect(label), "");
  if (!result) {
    lines.push(`- Status: **${statusName(row)}**, ${STATUS[rowStatus(row)]?.meaning ?? ""}`);
    return lines;
  }
  lines.push("**Verdict-carrying questions**", "", ...questionTable(VERDICT_KEYS, label, result, missing), "");
  lines.push("**Descriptive questions**", "", ...questionTable(OTHER_KEYS, label, result, missing), "");
  lines.push(...outcome(row, result));
  return lines;
}

/** The label in plain words. @param {CalibrationLabel} label */
function knownDefect(label) {
  const parts = [label.defect === "clean" ? "**Known defect: none.** It is a clean test." : `**Known defect: ${label.defect ?? "not named"}.**`];
  if (label.mixed) parts.push("It is a mixed case. Its answers can disagree, so the tool should escalate it.");
  else if (label.mustEscalate === true) parts.push("The tool should escalate it.");
  else if (label.mustEscalate === false) parts.push("The tool should pass it, with no escalation.");
  else parts.push("The label does not say if the tool should escalate it.");
  parts.push(label.canFail === undefined ? "The label sets no `can_fail` value." : `\`can_fail\` should be ${yesNo(label.canFail)}.`);
  for (const [key, value] of Object.entries(label)) {
    if (LABEL_KEYS.has(key) || value === undefined) continue;
    parts.push(key in BATTERY ? `${code(key)} should be ${valueText(value)}.` : `Label field ${code(key)}: ${valueText(value)}.`);
  }
  if (label.note) parts.push(`Note: ${label.note}${/[.!?]$/.test(label.note) ? "" : "."}`);
  const lines = [parts.join(" ")];
  if (label.sources?.length) {
    lines.push("", `Sources: ${label.sources.map((source) => (source.url ? `[${source.name}](${source.url})` : source.name)).join("; ")}.`);
  }
  return lines;
}

/**
 * One row for each question: what it checks, the answer, and its effect. The
 * combined can_fail and asserts rows follow their phrasings.
 * @param {string[]} keys @param {CalibrationLabel} label @param {AuditResult} result @param {Set<string>} missing
 */
function questionTable(keys, label, result, missing) {
  const lines = ["| Question | Checks | Answer | Effect |", "| --- | --- | --- | --- |"];
  for (const key of keys) {
    const question = BATTERY[key];
    const value = answerValue(key, question, result);
    lines.push(`| ${code(key)} | ${escapeCell(checksText(question))} | ${escapeCell(answerText(key, question, result, missing))} | ${effectText(key, label, result, value)} |`);
    if (key === CAN_FAIL_KEYS[CAN_FAIL_KEYS.length - 1]) lines.push(canFailRow(label, result));
    if (key === ASSERTS_KEYS[ASSERTS_KEYS.length - 1]) lines.push(assertsRow(result));
  }
  return lines;
}

/** What a question checks, from its criteria. @param {Question} question */
function checksText(question) {
  if (Array.isArray(question.criteria)) return `scale: ${question.criteria.join(", ")}`;
  if (question.type === "noul") return `yes: ${question.criteria.true}`;
  return `one of: ${Object.keys(question.criteria).join(", ")}`;
}

/** @param {Question} question */
function levelsOf(question) {
  return Array.isArray(question.criteria) ? question.criteria : [];
}

/**
 * The answer as a value: a boolean for yes/no, a string for a choice or a level.
 * A raw answer wins. A record without raw answers falls back to the result fields.
 * @param {string} key @param {Question} question @param {AuditResult} result
 * @returns {boolean | string | undefined}
 */
function answerValue(key, question, result) {
  const raw = result.answers[key];
  if (!raw) return derivedValue(key, result);
  if (!trusted(raw)) return undefined;
  if (question.type === "noul" && typeof raw.noul === "number") return raw.noul >= 0.5;
  if (question.type === "choice" && typeof raw.choice === "string") return raw.choice;
  if (question.type === "score" && typeof raw.score === "number") {
    const levels = levelsOf(question);
    return levels[Math.round(raw.score)] ?? "off the scale";
  }
  return undefined;
}

/** The value the result holds for one question, when the record has no raw answer. @param {string} key @param {AuditResult} result */
function derivedValue(key, result) {
  if (key in FLAG_BY_GATE) return result.descriptive[key];
  if (key in ESCALATE_ON_FALSE) {
    const value = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (result))[key];
    return typeof value === "boolean" ? value : undefined;
  }
  if (key === ASSERTS_KEYS[0]) return result.asserts.a;
  if (key === ASSERTS_KEYS[1]) return result.asserts.b;
  if (key === "type") return result.type;
  if (key === "verdict") return result.score.label;
  return undefined;
}

/**
 * The answer cell: the value and its number, or why there is none.
 * @param {string} key @param {Question} question @param {AuditResult} result @param {Set<string>} missing
 */
function answerText(key, question, result, missing) {
  const raw = result.answers[key];
  const value = answerValue(key, question, result);
  if (!raw) return value !== undefined ? valueText(value) : missing.has(key) ? "not recorded" : "unanswered";
  if (!trusted(raw)) return `untrusted (mass ${raw.mass?.toFixed(2)})`;
  if (value === undefined) return "unanswered";
  const number = question.type === "noul" ? raw.noul : question.type === "choice" ? raw.probabilities?.[String(value)] : raw.score;
  return typeof number === "number" ? `${valueText(value)} (${number.toFixed(2)})` : valueText(value);
}

/**
 * The effect cell: whether the answer matches the label, the flag it raises,
 * and the escalation reasons it carries.
 * @param {string} key @param {CalibrationLabel} label @param {AuditResult} result @param {boolean | string | undefined} value
 */
function effectText(key, label, result, value) {
  const parts = [];
  const expected = expectedAnswer(key, label);
  if (expected !== undefined && value !== undefined) {
    parts.push(value === expected ? "as expected" : `**not as expected** (label: ${valueText(expected)})`);
  }
  if (key in FLAG_BY_GATE && value === false) parts.push(`flag ${code(FLAG_BY_GATE[key])}`);
  parts.push(...reasonsOf(key, result).map(escalates));
  return parts.join("; ") || "-";
}

/**
 * The answer the label expects for one question, in the question's own polarity.
 * @param {string} key @param {CalibrationLabel} label
 * @returns {boolean | string | undefined}
 */
function expectedAnswer(key, label) {
  if (CAN_FAIL_KEYS.includes(key)) return label.canFail === undefined ? undefined : CAN_FAIL_NEGATED.has(key) ? !label.canFail : label.canFail;
  const value = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (label))[key];
  return typeof value === "boolean" || typeof value === "string" ? value : undefined;
}

/**
 * The escalation reasons that belong to one question, or to the combined
 * `can_fail` or `asserts` row.
 * @param {string} key @param {AuditResult} result
 */
function reasonsOf(key, result) {
  if (key in ESCALATE_ON_FALSE) {
    const reason = /** @type {Record<string, string>} */ (ESCALATE_ON_FALSE)[key];
    return result.reasons.filter((text) => text === reason || text === `${key} unclassified`);
  }
  if (key === "verdict" || key === "can_fail" || key === "asserts") return result.reasons.filter((text) => text.startsWith(`${key} `));
  return [];
}

/** The combined can_fail row: the mean, the spread, and the value the tool committed to. @param {CalibrationLabel} label @param {AuditResult} result */
function canFailRow(label, result) {
  const { mean, spread, state } = result.canFail;
  const answer = mean === null ? "unanswered" : `mean ${canFailText(result.canFail)}, spread ${spread === null ? "-" : spread.toFixed(2)} (${state})`;
  const parts = reasonsOf("can_fail", result).map(escalates);
  const said = saidCanFail(result);
  if (label.canFail !== undefined && said !== undefined) {
    parts.unshift(said === label.canFail ? "matches the label" : `**WRONG**: the label says ${yesNo(label.canFail)}`);
  }
  return `| *can_fail* | the mean probability that the test can fail, over the ${CAN_FAIL_KEYS.length} phrasings, and their spread | ${escapeCell(answer)} | ${parts.join("; ") || "-"} |`;
}

/** The combined asserts row: the pair must agree on the real guard. @param {AuditResult} result */
function assertsRow(result) {
  const { trust, agrees, value, a, b } = result.asserts;
  const answer = !trust ? "unanswered" : agrees ? String(value) : `${a} versus ${b}`;
  const parts = reasonsOf("asserts", result).map(escalates);
  return `| *asserts* | ${ASSERTS_KEYS.map(code).join(" and ")} agree on ${code(ASSERT_PASS)} | ${escapeCell(answer)} | ${parts.join("; ") || "-"} |`;
}

/** The outcome: the verdict, the escalation, and the status against the label. @param {CalibrationRow} row @param {AuditResult} result */
function outcome(row, result) {
  const { label } = row;
  const expected = label.mixed ? "escalate (a mixed case)" : label.mustEscalate === true ? "escalate" : label.mustEscalate === false ? "pass" : "either (the label does not say)";
  const eyes = result.needsEyes ? `**yes**. Reasons: ${result.reasons.join("; ")}.` : "**no**.";
  return [
    `**Outcome**`,
    "",
    `- Verdict: **${result.score.label ?? "unclassified"}**.`,
    `- Needs eyes: ${eyes}`,
    `- Expected: ${expected}.`,
    `- Status: **${statusName(row)}**, ${STATUS[rowStatus(row)]?.meaning ?? ""}`,
  ];
}

/** @param {string} reason */
function escalates(reason) {
  return `escalates: ${escapeCell(reason)}`;
}

/** @param {boolean | string} value */
function valueText(value) {
  return typeof value === "boolean" ? yesNo(value) : String(value);
}

/** @param {boolean} value */
function yesNo(value) {
  return value ? "yes" : "no";
}

/** A markdown code span that survives a backtick in the text. @param {string} text */
function code(text) {
  return text.includes("`") ? `\`\` ${text} \`\`` : `\`${text}\``;
}

/** A fenced code block whose fence is longer than any backtick run in the text. @param {string} text @param {string} language */
function fenced(text, language) {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return [`${fence}${language}`, text, fence];
}

/** The fence language for a case file, from its extension. @param {string} file */
function languageOf(file) {
  const extension = file.slice(file.lastIndexOf(".") + 1);
  return { mjs: "js", cjs: "js", mts: "ts", cts: "ts" }[extension] ?? extension;
}

/** @param {Judgement} verdict */
function summaryLine(verdict) {
  return (
    `can_fail agreement: ${verdict.correct}/${verdict.resolved} resolved (${Math.round(verdict.agreement * 100)}%). ` +
    `Silent passes: ${verdict.silentPasses}. Mixed routed: ${verdict.mixedRouted}/${verdict.mixedTotal}. ` +
    `False positives: ${verdict.falsePositives}/${verdict.goodTotal}. ` +
    `deterministic: ${verdict.deterministicCorrect}/${verdict.deterministicTotal}.` +
    (verdict.unresolved ? ` Unresolved: ${verdict.unresolved}.` : "")
  );
}

/** Per-defect escalation, so a whole defect family that slips through shows. @param {Judgement} verdict */
function defectLine(verdict) {
  const parts = Object.entries(verdict.defects)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([defect, group]) => `${defect} ${group.escalated}/${group.total}${group.escalated === group.total ? "" : "!"}`);
  return `defects escalated: ${parts.join(", ") || "none"}`;
}
