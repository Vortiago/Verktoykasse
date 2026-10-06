// The calibration faces: a detailed table for one endpoint, a comparison matrix
// for several, and a per-case benchmark in markdown.

import { canFailText, escapeCell, pad } from "../report/index.mjs";
import { trusted } from "../classifier/index.mjs";
import { ASSERT_PASS, BATTERY, CAN_FAIL_KEYS, ESCALATE_ON_FALSE, FLAG_BY_GATE, NEGATED } from "../checks/index.mjs";
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
/** The verdict-carrying questions. */
const VERDICT_KEYS = [...CAN_FAIL_KEYS, ...ASSERTS_KEYS, ...Object.values(ESCALATE_ON_FALSE).flatMap((gate) => gate.keys), "verdict"];
/** Every other question, in battery order: `type`, the descriptive questions, and any new one. */
const OTHER_KEYS = Object.keys(BATTERY).filter((key) => !VERDICT_KEYS.includes(key));
/** The label fields the "known defect" line states in its own words. */
const LABEL_KEYS = new Set(["file", "test", "defect", "canFail", "mustEscalate", "mixed", "note", "code", "group", "sources"]);

/**
 * The benchmark report in markdown. A summary for each target comes first: the
 * headline numbers, one row for each defect family, and links to the cases that
 * are not OK. Then one table row for each case, and one collapsible block for
 * each case: the test, the code under test, the label, the answers behind each
 * escalation, and the descriptive answers in one line. A legend and the list of
 * questions close the report. The questions come from the battery, so a new
 * question appears without an edit.
 * @param {CalibrationEntry[]} entries
 * @param {{ preamble?: string[] }} [opts] markdown lines that go under the title, such as the date and the command
 */
export function formatBenchmark(entries, opts = {}) {
  const lines = ["# test-audit benchmark", ""];
  if (opts.preamble?.length) lines.push(...opts.preamble, "");
  lines.push(
    "This file records a calibration run of `test-audit` over the labelled corpus. Each case is one test with a known defect, or a clean test. The [legend](#legend) explains the terms.",
    "",
  );
  const prefix = (/** @type {number} */ index) => (entries.length > 1 ? `t${index + 1}-` : "");
  entries.forEach((entry, index) => lines.push(...summarySection(entry, prefix(index)), ""));
  entries.forEach((entry, index) => lines.push(...glanceSection(entry, prefix(index)), "", ...detailsSection(entry, prefix(index)), ""));
  lines.push(...legend());
  return lines.join("\n").trimEnd();
}

/** The rows in report order: the cases that are not OK first, then by defect family and test name. @param {CalibrationRow[]} rows */
function orderedRows(rows) {
  const rank = (/** @type {CalibrationRow} */ row) => (rowStatus(row) === "ok" ? 1 : 0);
  return [...rows].sort((a, b) => rank(a) - rank(b) || family(a).localeCompare(family(b)) || a.label.test.localeCompare(b.label.test));
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

/** The headline numbers, the defect families, and links to the cases that are not OK. @param {CalibrationEntry} entry @param {string} prefix */
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
  const byFamily = [...rows].sort((a, b) => family(a).localeCompare(family(b)));
  for (const row of byFamily) families.set(family(row), [...(families.get(family(row)) ?? []), row]);
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

/** The outcome one label expects, in one word. @param {CalibrationLabel} label */
function expectedOutcome(label) {
  if (label.mixed) return "escalate (mixed)";
  return label.mustEscalate === true ? "escalate" : label.mustEscalate === false ? "pass" : "either";
}

/** The verdict and whether the case escalated. @param {CalibrationRow} row */
function resultText(row) {
  if (!row.result) return "no result";
  return `${row.result.score.label ?? "unclassified"}, ${row.result.needsEyes ? "needs eyes" : "passes"}`;
}

/** One table row for each case, in report order. @param {CalibrationEntry} entry @param {string} prefix */
function glanceSection(entry, prefix) {
  const lines = [
    `## Cases at a glance: ${entry.target.model}`,
    "",
    "The cases that are not OK come first, then the others by defect family. A test name links to its details.",
    "",
    "| # | Test | Known defect | Expected | Result | Status |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  orderedRows(entry.rows).forEach((row, index) => {
    const number = index + 1;
    const status = rowStatus(row) === "ok" ? "OK" : `**${statusName(row)}**`;
    const test = `[${code(row.label.test).replaceAll("|", "\\|")}](#${prefix}case-${number})`;
    lines.push(`| ${number} | ${test} | ${escapeCell(family(row))} | ${expectedOutcome(row.label)} | ${escapeCell(resultText(row))} | ${status} |`);
  });
  return lines;
}

/** One collapsible block for each case, in report order. @param {CalibrationEntry} entry @param {string} prefix */
function detailsSection(entry, prefix) {
  const missing = new Set(entry.missing ?? []);
  const lines = [`## Case details: ${entry.target.model}`, "", "Click a case to open it. The cases that are not OK are open.", ""];
  orderedRows(entry.rows).forEach((row, index) => lines.push(...caseBlock(row, index + 1, prefix, missing)));
  return lines;
}

/**
 * One case as a `<details>` block: the test source, the code under test, the
 * label, what decided the outcome, and the descriptive answers.
 * @param {CalibrationRow} row @param {number} number @param {string} prefix @param {Set<string>} missing
 */
function caseBlock(row, number, prefix, missing) {
  const { label, test, result } = row;
  const ok = rowStatus(row) === "ok";
  const status = ok ? "OK" : `<b>${html(statusName(row))}</b>`;
  const summary = `<summary><a id="${prefix}case-${number}"></a>${number}. <code>${html(label.test)}</code> · ${html(family(row))} · ${status}</summary>`;
  const lines = [`<details${ok ? "" : " open"}>${summary}`, ""];
  if (test) {
    lines.push(...fenced(test.source, languageOf(label.file)));
    if (test.fixtures?.length) lines.push("", "Fixtures:", "", ...fenced(test.fixtures.join("\n\n"), languageOf(label.file)));
  }
  if (row.code) {
    const where = label.code ? `, [${code(label.code)}](calibration/${label.code})` : "";
    lines.push(`Code under test${where}:`, "", ...fenced(row.code, languageOf(label.code ?? label.file)));
  }
  lines.push(`- ${knownDefect(row)}`);
  if (result) lines.push(...decided(label, result, missing), `- ${descriptive(label, result, missing)}`);
  else lines.push(`- **Status:** ${statusName(row)}, ${STATUS[rowStatus(row)]?.meaning ?? ""}${row.error ? ` Error: ${row.error}.` : ""}`);
  lines.push("</details>");
  return lines;
}

/** The label in plain words: the known defect, the expected answers, the note, and where the test is. @param {CalibrationRow} row */
function knownDefect(row) {
  const { label, test } = row;
  const parts = [label.defect === "clean" ? "**Known defect:** none, a clean test." : `**Known defect:** ${label.defect ?? "not named"}.`];
  if (label.mixed) parts.push("It is a mixed case, so its answers can disagree.");
  const expected = [label.mixed || label.mustEscalate === true ? "escalate" : label.mustEscalate === false ? "pass" : "escalate or pass"];
  if (label.canFail !== undefined) expected.push(`${code("can_fail")} ${yesNo(label.canFail)}`);
  for (const [key, value] of labelAnswers(label)) expected.push(`${code(key)} ${valueText(value)}`);
  parts.push(`**Expected:** ${expected.join(", ")}.`);
  for (const [key, value] of Object.entries(label)) {
    if (!LABEL_KEYS.has(key) && !(key in BATTERY) && value !== undefined) parts.push(`Label field ${code(key)}: ${valueText(/** @type {boolean | string} */ (value))}.`);
  }
  if (label.note) parts.push(`Note: ${label.note}${/[.!?]$/.test(label.note) ? "" : "."}`);
  if (test) {
    const scope = test.scope?.length ? `, inside ${test.scope.map(code).join(" > ")}` : "";
    parts.push(`Case file [${code(label.file)}](calibration/${label.file}), line ${test.line}${scope}.`);
    if (test.flags?.length) parts.push(`Extractor notes: ${test.flags.map(code).join(", ")}.`);
  } else {
    parts.push(`No test source: ${row.error ?? "the case file holds no test with this name"}.`);
  }
  if (label.sources?.length) parts.push(`Sources: ${label.sources.map((source) => (source.url ? `[${source.name}](${source.url})` : source.name)).join("; ")}.`);
  return parts.join(" ");
}

/**
 * The answers the label sets for questions of the battery, other than can_fail.
 * @param {CalibrationLabel} label
 * @returns {Array<[string, boolean | string]>}
 */
function labelAnswers(label) {
  return /** @type {Array<[string, boolean | string]>} */ (
    Object.entries(label).filter(([key, value]) => !LABEL_KEYS.has(key) && key in BATTERY && (typeof value === "boolean" || typeof value === "string"))
  );
}

/**
 * What decided the outcome. Each verdict-carrying answer that escalates, or
 * that commits to the wrong can_fail value, gets its own line: the phrasings,
 * the value they give, and the reasons. One last line holds the other answers.
 * @param {CalibrationLabel} label @param {AuditResult} result @param {Set<string>} missing
 */
function decided(label, result, missing) {
  /** @type {Set<string>} */
  const claimed = new Set();
  const take = (/** @type {(reason: string) => boolean} */ match) => {
    const found = result.reasons.filter((reason) => !claimed.has(reason) && match(reason));
    for (const reason of found) claimed.add(reason);
    return found;
  };
  const said = saidCanFail(result);
  const answers = [
    {
      text: answerSentence(CAN_FAIL_KEYS, `can_fail: ${canFailValue(result)}`, result, missing),
      reasons: take((reason) => reason.startsWith("can_fail ")),
      check: canFailLabel(label, result),
      wrong: label.canFail !== undefined && said !== undefined && said !== label.canFail,
    },
    { text: answerSentence(ASSERTS_KEYS, `asserts: ${assertsValue(result)}`, result, missing), reasons: take((reason) => reason.startsWith("asserts ")) },
    ...Object.entries(ESCALATE_ON_FALSE).map(([gate, { keys, reason }]) => ({
      text: answerSentence(keys, `${gate}: ${gateValue(gate, keys, result, missing)}`, result, missing),
      reasons: take((text) => text === reason || text.startsWith(`${gate} `)),
    })),
    { text: answerSentence(["verdict"], "", result, missing), reasons: take((reason) => reason.startsWith("verdict ")) },
  ].map((answer) => ({ check: "", wrong: false, ...answer }));
  const lines = [`- **What decided it:** ${result.score.label ?? "unclassified"}, ${result.needsEyes ? "needs eyes" : "passes"}.`];
  const loud = answers.filter((answer) => answer.reasons.length || answer.wrong);
  for (const answer of loud) {
    const escalates = answer.reasons.length ? `**Escalates:** ${answer.reasons.join(", ")}.` : "";
    lines.push(`  - ${[answer.text, escalates, answer.check].filter(Boolean).join(" ")}`);
  }
  const rest = result.reasons.filter((reason) => !claimed.has(reason));
  if (rest.length) lines.push(`  - **Escalates:** ${rest.join(", ")}.`);
  const quiet = answers.filter((answer) => !loud.includes(answer));
  if (quiet.length) lines.push(`  - No escalation: ${quiet.map((answer) => [answer.text, answer.check].filter(Boolean).join(" ")).join(" ")}`);
  return lines;
}

/**
 * One verdict-carrying answer as a sentence: each phrasing and its answer, then
 * the value they give.
 * @param {string[]} keys @param {string} combined @param {AuditResult} result @param {Set<string>} missing
 */
function answerSentence(keys, combined, result, missing) {
  const notRecorded = keys.every((key) => !result.answers[key] && missing.has(key));
  const answers = notRecorded ? `${keys.map(code).join(" · ")} not recorded` : keys.map((key) => `${code(key)} ${answerText(key, BATTERY[key], result, missing)}`).join(" · ");
  return combined ? `${answers} → ${combined}.` : `${answers}.`;
}

/** The mean, the spread and the state of the can_fail phrasings. @param {AuditResult} result */
function canFailValue(result) {
  const { mean, spread, state } = result.canFail;
  if (mean === null) return "unanswered";
  return `${mean.toFixed(2)}${spread === null ? "" : `, spread ${spread.toFixed(2)}`} (${state})`;
}

/** The can_fail value against the label: a match, WRONG, or not scored. @param {CalibrationLabel} label @param {AuditResult} result */
function canFailLabel(label, result) {
  if (label.canFail === undefined) return "";
  const said = saidCanFail(result);
  if (said === undefined) return `Label ${yesNo(label.canFail)}: not scored.`;
  if (said === label.canFail) return `Label ${yesNo(label.canFail)}: match.`;
  return `**WRONG can_fail:** label ${yesNo(label.canFail)}, tool ${canFailText(result.canFail)}.`;
}

/** The value both asserts phrasings agree on, or both values. @param {AuditResult} result */
function assertsValue(result) {
  const { trust, agrees, value, a, b } = result.asserts;
  if (trust && agrees) return String(value);
  if (a === undefined && b === undefined) return "unanswered";
  return `${a ?? "unanswered"} versus ${b ?? "unanswered"}`;
}

/**
 * The value of a twin gate: yes or no when both phrasings agree, or why not.
 * @param {string} gate @param {string[]} keys @param {AuditResult} result @param {Set<string>} missing
 */
function gateValue(gate, keys, result, missing) {
  const value = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (result))[gate];
  if (typeof value === "boolean") return yesNo(value);
  const pair = result.pairs?.[gate];
  if (pair && pair.state !== "stable") return pair.state;
  if (keys.every((key) => !result.answers[key] && missing.has(key))) return "not recorded";
  return "unanswered";
}

/**
 * The descriptive answers in one line: the clean count, each smell and its flag,
 * the questions with no answer, any other question, and the label checks.
 * @param {CalibrationLabel} label @param {AuditResult} result @param {Set<string>} missing
 */
function descriptive(label, result, missing) {
  /** @type {string[]} */
  const smells = [];
  /** @type {string[]} */
  const unanswered = [];
  /** @type {string[]} */
  const notRecorded = [];
  /** @type {string[]} */
  const others = [];
  let clean = 0;
  for (const key of OTHER_KEYS) {
    const question = BATTERY[key];
    if (question.type !== "noul") {
      others.push(`${code(key)} ${answerText(key, question, result, missing)}`);
      continue;
    }
    const value = answerValue(key, question, result);
    if (value === true) clean += 1;
    else if (value === false) smells.push(key in FLAG_BY_GATE ? `${code(key)} (${FLAG_BY_GATE[key]})` : code(key));
    else if (!result.answers[key] && missing.has(key)) notRecorded.push(code(key));
    else unanswered.push(code(key));
  }
  const parts = [`${clean} clean`, `smells: ${smells.join(", ") || "none"}`, `unanswered: ${unanswered.join(", ") || "none"}`];
  if (notRecorded.length) parts.push(`not recorded: ${notRecorded.join(", ")}`);
  parts.push(...others);
  for (const [key, expected] of labelAnswers(label)) {
    if (!OTHER_KEYS.includes(key)) continue;
    const value = answerValue(key, BATTERY[key], result);
    const want = `label ${code(key)} ${valueText(expected)}`;
    parts.push(value === undefined ? `${want}: no answer` : value === expected ? `${want}: match` : `**${want}, tool ${valueText(value)}**`);
  }
  return `**Descriptive:** ${parts.join(" · ")}.`;
}

/** The terms, explained once, and the questions of the battery. */
function legend() {
  const levels = levelsOf(BATTERY.verdict);
  const gates = Object.entries(ESCALATE_ON_FALSE).map(([gate, { keys }]) => `${code(gate)} (${keys.map(code).join(", ")})`);
  return [
    "## Legend",
    "",
    "- **Case**: one labelled test in `calibration/cases/`. Its label in `calibration/labels/` states the known defect and the expected outcome.",
    "- **Escalate**: the tool sends the test to a human, so the test **needs eyes**. Each reason says why. A test with no reason **passes**.",
    `- **can_fail**: the probability that a change to the code under test can make the test fail. The tool asks it in ${CAN_FAIL_KEYS.length} phrasings and takes the mean. The **spread** is the highest value minus the lowest. A spread above \`TEST_AUDIT_STABLE_BAND\` makes the value borderline or unstable, and the test escalates.`,
    `- **Twin pair**: ${gates.join(" and ")}. The tool asks each twice. The value counts only when both phrasings agree. A "no" escalates.`,
    `- **Negated phrasing**: ${[...NEGATED].map(code).join(", ")} ask the opposite, so their "no" is the good answer.`,
    `- **asserts**: what the assertion checks. Only ${code(ASSERT_PASS)} is a real guard. ${ASSERTS_KEYS.map(code).join(" and ")} list the options in opposite order, and must agree.`,
    `- **verdict**: a score from 0 (${levels[0]}) to ${levels.length - 1} (${levels[levels.length - 1]}). A verdict of weak or lower escalates.`,
    '- **Descriptive question**: a "no" is a **smell**. It raises the flag in brackets. It does not escalate the test.',
    "- **Number in brackets**: for a yes/no question, the probability of yes. For a choice, the probability of the chosen option. For the verdict, the score.",
    "- **not recorded**: the run did not record the value. **unanswered**: the endpoint gave no answer. **untrusted**: the answer has a `mass` below `TEST_AUDIT_MIN_MASS`. **not scored**: the tool did not commit to a can_fail value, so the agreement does not count the case.",
    "- **Status** of a case:",
    ...Object.values(STATUS).map((status) => `  - **${status.name}**: ${status.meaning}`),
    "",
    "### Questions",
    "",
    "The tool asks each test these questions in one call.",
    "",
    "| Question | Asks | Answer |",
    "| --- | --- | --- |",
    ...Object.entries(BATTERY).map(([key, question]) => `| ${code(key)} | ${escapeCell(question.instructions)} | ${escapeCell(checksText(question))} |`),
  ];
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
  if (key === ASSERTS_KEYS[0]) return result.asserts.a;
  if (key === ASSERTS_KEYS[1]) return result.asserts.b;
  if (key === "type") return result.type;
  if (key === "verdict") return result.score.label;
  return undefined;
}

/**
 * The answer: the value and its number, or why there is none.
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

/** Text for an HTML element, such as the summary line of a case. @param {string} text */
function html(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** A fenced code block whose fence is longer than any backtick run in the text. @param {string} text @param {string} language */
function fenced(text, language) {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return [`${fence}${language}`, text.replace(/\n$/, ""), fence];
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
