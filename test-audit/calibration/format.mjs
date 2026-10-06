// The calibration faces: a detailed table for one endpoint, a comparison matrix
// for several, and a per-case benchmark in markdown.

import { canFailText, escapeCell, pad } from "../report/index.mjs";
import { questionValue, trusted } from "../classifier/index.mjs";
import { BATTERY, CHECKS } from "../checks/index.mjs";
import { rowStatus, saidCanFail, shortStatus } from "./judge.mjs";

/** @typedef {import("../types.d.ts").AuditUsage} AuditUsage */
/** @typedef {import("../types.d.ts").AuditResult} AuditResult */
/** @typedef {import("../types.d.ts").CalibrationLabel} CalibrationLabel */
/** @typedef {import("../types.d.ts").CalibrationRow} CalibrationRow */
/** @typedef {import("../types.d.ts").AuditAnswer} AuditAnswer */
/** @typedef {import("../types.d.ts").Check} Check */
/** @typedef {import("../classifier/systemone.mjs").Question} Question */
/** @typedef {ReturnType<typeof import("./judge.mjs").judge>} Judgement */
/** One endpoint and model's run over the corpus. @typedef {{ target: { url: string, model: string }, rows: CalibrationRow[], verdict: Judgement, usage: AuditUsage }} CalibrationEntry */
/** One case in report order: its row, its number, and the anchor its links point at. @typedef {{ row: CalibrationRow, number: number, anchor: string }} NumberedRow */

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
        pad(row.label.canFail === undefined ? "-" : valueText(row.label.canFail), 6),
        pad(result ? canFailText(result.canFail) : "-", 9),
        pad(result?.canFail?.state ?? row.error ?? "-", 11),
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

/**
 * The benchmark report in markdown. A summary for each target comes first: the
 * headline numbers, one row for each defect family, and links to the cases that
 * are not OK. Then one table row for each case, and one collapsible block for
 * each case: the test, the code under test, the label, the answers behind each
 * escalation, and the descriptive answers in one line. A legend and the list of
 * questions close the report. The questions come from the checks, so a new
 * check appears without an edit.
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
  const numbered = entries.map((entry, index) => numberedRows(entry.rows, entries.length > 1 ? `t${index + 1}-` : ""));
  entries.forEach((entry, index) => lines.push(...summarySection(entry, numbered[index]), ""));
  entries.forEach((entry, index) => lines.push(...glanceSection(entry, numbered[index]), "", ...detailsSection(entry, numbered[index]), ""));
  lines.push(...legend());
  return lines.join("\n").trimEnd();
}

/**
 * The rows in report order, numbered: the cases that are not OK first, then by
 * defect family and test name.
 * @param {CalibrationRow[]} rows @param {string} prefix the anchor prefix of the target
 * @returns {NumberedRow[]}
 */
function numberedRows(rows, prefix) {
  const rank = (/** @type {CalibrationRow} */ row) => (rowStatus(row) === "ok" ? 1 : 0);
  const ordered = [...rows].sort((a, b) => rank(a) - rank(b) || family(a).localeCompare(family(b)) || a.label.test.localeCompare(b.label.test));
  return ordered.map((row, index) => ({ row, number: index + 1, anchor: `${prefix}case-${index + 1}` }));
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

/** A share as a whole percent. @param {number} share */
function percent(share) {
  return `${Math.round(share * 100)}%`;
}

/** The headline numbers, the defect families, and links to the cases that are not OK. @param {CalibrationEntry} entry @param {NumberedRow[]} numbered */
function summarySection(entry, numbered) {
  const { target, rows, verdict, usage } = entry;
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
  const families = Map.groupBy([...rows].sort((a, b) => family(a).localeCompare(family(b))), family);
  for (const [name, group] of families) {
    const escalated = group.filter((row) => row.result?.needsEyes).length;
    const bad = group.filter((row) => rowStatus(row) !== "ok");
    const ok = bad.length ? `**no**: ${countText(bad.map(statusName))}` : "yes";
    lines.push(`| ${escapeCell(name)} | ${group.length} | ${escalated} | ${expectedText(group.map((row) => row.label))} | ${ok} |`);
  }

  const notOk = numbered.filter(({ row }) => rowStatus(row) !== "ok");
  const links = notOk.map(({ row, number, anchor }) => `[${number}. ${code(row.label.test)}](#${anchor}) ${statusName(row)}`);
  lines.push("", notOk.length ? `**Not OK:** ${links.join(" · ")}.` : "**Not OK:** none. Each case matches its label.");
  return lines;
}

/** What a family of labels expects: one outcome, or a count of each. @param {CalibrationLabel[]} labels */
function expectedText(labels) {
  const outcomes = labels.map(expectedOutcome);
  return new Set(outcomes).size === 1 ? outcomes[0] : countText(outcomes);
}

/** "2 FALSE positive, 1 WRONG can_fail". @param {string[]} names */
function countText(names) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => `${count} ${name}`).join(", ");
}

/** The outcome one label expects, in one word: escalate, pass, or either. A mixed case must escalate. @param {CalibrationLabel} label */
function expectedOutcome(label) {
  if (label.mixed || label.mustEscalate === true) return "escalate";
  return label.mustEscalate === false ? "pass" : "either";
}

/** The verdict and whether the case escalated. @param {AuditResult | undefined} result */
function resultText(result) {
  if (!result) return "no result";
  return `${result.score.label ?? "unclassified"}, ${result.needsEyes ? "needs eyes" : "passes"}`;
}

/** One table row for each case, in report order. @param {CalibrationEntry} entry @param {NumberedRow[]} numbered */
function glanceSection(entry, numbered) {
  const lines = [
    `## Cases at a glance: ${entry.target.model}`,
    "",
    "The cases that are not OK come first, then the others by defect family. A test name links to its details.",
    "",
    "| # | Test | Check | Known defect | Expected | Result | Status |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const { row, number, anchor } of numbered) {
    const status = rowStatus(row) === "ok" ? "OK" : `**${statusName(row)}**`;
    const test = `[${code(row.label.test).replaceAll("|", "\\|")}](#${anchor})`;
    lines.push(`| ${number} | ${test} | ${checkLink(row.label)} | ${escapeCell(family(row))} | ${expectedOutcome(row.label)} | ${escapeCell(resultText(row.result))} | ${status} |`);
  }
  return lines;
}

/** The check a case belongs to, linked to its check file. @param {CalibrationLabel} label */
function checkLink(label) {
  return `[${code(label.check)}](checks/${label.check}/check.mjs)`;
}

/** One collapsible block for each case, in report order. @param {CalibrationEntry} entry @param {NumberedRow[]} numbered */
function detailsSection(entry, numbered) {
  const lines = [`## Case details: ${entry.target.model}`, "", "Click a case to open it. The cases that are not OK are open.", ""];
  for (const item of numbered) lines.push(...caseBlock(item));
  return lines;
}

/**
 * One case as a `<details>` block: the test source, the code under test, the
 * label, what decided the outcome, and the descriptive answers.
 * @param {NumberedRow} item
 */
function caseBlock({ row, number, anchor }) {
  const { label, test, result } = row;
  const ok = rowStatus(row) === "ok";
  const status = ok ? "OK" : `<b>${html(statusName(row))}</b>`;
  const summary = `<summary><a id="${anchor}"></a>${number}. <code>${html(label.test)}</code> · ${html(family(row))} · ${status}</summary>`;
  const lines = [`<details${ok ? "" : " open"}>${summary}`, ""];
  if (test) {
    lines.push(...fenced(test.source, languageOf(label.file)));
    if (test.fixtures?.length) lines.push("", "Fixtures:", "", ...fenced(test.fixtures.join("\n\n"), languageOf(label.file)));
  }
  if (row.code) {
    const where = label.code ? `, [${code(label.code)}](${label.code})` : "";
    lines.push(`Code under test${where}:`, "", ...fenced(row.code, languageOf(label.code ?? label.file)));
  }
  lines.push(`- ${knownDefect(row)}`);
  const error = row.error ?? result?.error;
  if (result && !error) lines.push(...decided(label, result), `- ${descriptive(label, result)}`);
  else lines.push(`- **Status:** ${statusName(row)}, ${STATUS[rowStatus(row)]?.meaning ?? ""}${error ? ` Error: ${error}.` : ""}`);
  lines.push("</details>");
  return lines;
}

/** The label in plain words: the known defect, the expected answers, the note, and where the test is. @param {CalibrationRow} row */
function knownDefect(row) {
  const { label, test } = row;
  const parts = [label.defect === "clean" ? "**Known defect:** none, a clean test." : `**Known defect:** ${label.defect ?? "not named"}.`];
  if (label.mixed) parts.push("It is a mixed case, so its answers can disagree.");
  parts.push(`**Check:** ${checkLink(label)}.`);
  const expected = [expectedOutcome(label)];
  if (label.canFail !== undefined) expected.push(`${code("can_fail")} ${valueText(label.canFail)}`);
  for (const [key, value] of labelAnswers(label)) expected.push(`${code(key)} ${valueText(value)}`);
  parts.push(`**Expected:** ${expected.join(", ")}.`);
  if (label.note) parts.push(`Note: ${label.note}${/[.!?]$/.test(label.note) ? "" : "."}`);
  if (test) {
    const scope = test.scope?.length ? `, inside ${test.scope.map(code).join(" > ")}` : "";
    parts.push(`Case file [${code(label.file)}](${label.file}), line ${test.line}${scope}.`);
    if (test.flags?.length) parts.push(`Extractor notes: ${test.flags.map(code).join(", ")}.`);
  } else {
    parts.push(`No test source: ${row.error ?? "the case file holds no test with this name"}.`);
  }
  if (label.sources?.length) parts.push(`Sources: ${label.sources.map((source) => (source.url ? `[${source.name}](${source.url})` : source.name)).join("; ")}.`);
  return parts.join(" ");
}

/**
 * The answers the label sets for questions of the battery, such as
 * `deterministic`.
 * @param {CalibrationLabel} label
 * @returns {Array<[string, boolean | string]>}
 */
function labelAnswers(label) {
  /** @type {Array<[string, boolean | string]>} */
  const answers = [];
  for (const [key, value] of Object.entries(label)) {
    if (key in BATTERY && (typeof value === "boolean" || typeof value === "string")) answers.push([key, value]);
  }
  return answers;
}

/**
 * What decided the outcome. Each check that can escalate gets a sentence: its
 * phrasings, the value they give, and its reasons. A check that escalates, or
 * that commits to the wrong can_fail value, gets its own line. One last line
 * holds the others. The type and the descriptive checks are in their own line.
 * @param {CalibrationLabel} label @param {AuditResult} result
 */
function decided(label, result) {
  const lines = [`- **What decided it:** ${resultText(result)}.`];
  /** @type {string[]} */
  const quiet = [];
  for (const check of CHECKS) {
    if (check.role === "type" || check.role === "descriptive") continue;
    const reasons = result.checks[check.name]?.reasons ?? [];
    const note = check.role === "can-fail" ? canFailNote(label, result) : { text: "", wrong: false };
    const escalates = reasons.length ? `**Escalates:** ${reasons.join(", ")}.` : "";
    if (reasons.length || note.wrong) lines.push(`  - ${[answerSentence(check, result), escalates, note.text].filter(Boolean).join(" ")}`);
    else quiet.push([answerSentence(check, result), note.text].filter(Boolean).join(" "));
  }
  if (quiet.length) lines.push(`  - No escalation: ${quiet.join(" ")}`);
  return lines;
}

/**
 * One check as a sentence: each phrasing and its answer, then the value they
 * give, if the check asks more than one.
 * @param {Check} check @param {AuditResult} result
 */
function answerSentence(check, result) {
  const answers = Object.keys(check.questions)
    .map((key) => `${code(key)} ${answerText(key, result.answers[key])}`)
    .join(" · ");
  const { value, group } = result.checks[check.name] ?? {};
  if (!group) return `${answers}.`;
  // The can_fail mean also feeds the cross-question rule, so it shows with its spread.
  const combined = check.role === "can-fail" ? canFailValue(group) : value === undefined ? group.state : valueText(value);
  return `${answers} → ${check.name}: ${combined}.`;
}

/** The mean, the spread and the state of the can_fail phrasings. @param {import("../types.d.ts").Paraphrase} group */
function canFailValue({ mean, spread, state }) {
  if (mean === null) return "unanswered";
  return `${mean.toFixed(2)}${spread === null ? "" : `, spread ${spread.toFixed(2)}`} (${state})`;
}

/**
 * The can_fail value against the label: a match, WRONG, or not scored.
 * @param {CalibrationLabel} label @param {AuditResult} result
 * @returns {{ text: string, wrong: boolean }}
 */
function canFailNote(label, result) {
  if (label.canFail === undefined) return { text: "", wrong: false };
  const said = saidCanFail(result);
  const want = `Label ${valueText(label.canFail)}`;
  if (said === undefined) return { text: `${want}: not scored.`, wrong: false };
  if (said === label.canFail) return { text: `${want}: match.`, wrong: false };
  return { text: `**WRONG can_fail:** label ${valueText(label.canFail)}, tool ${canFailText(result.canFail)}.`, wrong: true };
}

/**
 * The descriptive answers in one line: the clean count, each smell and its flag,
 * the questions with no answer, the type, and the label checks.
 * @param {CalibrationLabel} label @param {AuditResult} result
 */
function descriptive(label, result) {
  /** @type {string[]} */
  const smells = [];
  /** @type {string[]} */
  const unanswered = [];
  /** @type {string[]} */
  const others = [];
  let clean = 0;
  for (const check of CHECKS) {
    if (check.role === "type") {
      for (const key of Object.keys(check.questions)) others.push(`${code(key)} ${answerText(key, result.answers[key])}`);
    } else if (check.role === "descriptive") {
      const value = result.checks[check.name]?.value;
      if (value === true) clean += 1;
      else if (value === false) smells.push(`${code(check.name)} (${check.flag})`);
      else unanswered.push(code(check.name));
    }
  }
  const parts = [`${clean} clean`, `smells: ${smells.join(", ") || "none"}`, `unanswered: ${unanswered.join(", ") || "none"}`, ...others];
  for (const [key, expected] of labelAnswers(label)) {
    const value = questionValue(key, result.answers[key]);
    const want = `label ${code(key)} ${valueText(expected)}`;
    parts.push(value === undefined ? `${want}: no answer` : value === expected ? `${want}: match` : `**${want}, tool ${valueText(value)}**`);
  }
  return `**Descriptive:** ${parts.join(" · ")}.`;
}

/** The terms, explained once, and the questions of the battery. */
function legend() {
  const [canFail] = CHECKS.filter((check) => check.role === "can-fail");
  const [asserts] = CHECKS.filter((check) => check.role === "asserts");
  const [verdict] = CHECKS.filter((check) => check.role === "verdict");
  const gates = CHECKS.filter((check) => check.role === "gate").map((check) => `${code(check.name)} (${Object.keys(check.questions).map(code).join(", ")})`);
  const negated = CHECKS.flatMap((check) => check.negated ?? []);
  const levels = verdict.levels;
  return [
    "## Legend",
    "",
    "- **Case**: one labelled test in `checks/<check>/cases/<case>/`. `case.mjs` holds the test, `label.json` states the known defect and the expected outcome, and `code.mjs`, if the case has one, holds the code under test.",
    "- **Check**: the check that the case is meant to catch, in `checks/<check>/check.mjs`. A clean case and a mixed case belong to the `verdict` check.",
    "- **Escalate**: the tool sends the test to a human, so the test **needs eyes**. Each reason says why. A test with no reason **passes**.",
    `- **can_fail**: the probability that a change to the code under test can make the test fail. The tool asks it in ${Object.keys(canFail.questions).length} phrasings and takes the mean. The **spread** is the highest value minus the lowest. A spread above \`TEST_AUDIT_STABLE_BAND\` makes the value borderline or unstable, and the test escalates.`,
    `- **Twin pair**: ${gates.join(" and ")}. The tool asks each twice. The value counts only when both phrasings agree. A "no" escalates.`,
    `- **Negated phrasing**: ${negated.map(code).join(", ")} ask the opposite, so their "no" is the good answer.`,
    `- **asserts**: what the assertion checks. Only ${code(Object.keys(asserts.kinds)[0])} is a real guard. ${Object.keys(asserts.questions).map(code).join(" and ")} list the options in opposite order, and must agree.`,
    `- **verdict**: a score from 0 (${levels[0]}) to ${levels.length - 1} (${levels[levels.length - 1]}). A verdict of weak or lower escalates.`,
    '- **Descriptive question**: a "no" is a **smell**. It raises the flag in brackets. It does not escalate the test.',
    "- **Number in brackets**: for a yes/no question, the probability of yes. For a choice, the probability of the chosen option. For the verdict, the score.",
    "- **unanswered**: the endpoint gave no answer. **untrusted**: the answer has a `mass` below `TEST_AUDIT_MIN_MASS`. **not scored**: the tool did not commit to a can_fail value, so the agreement does not count the case.",
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

/**
 * One answer as the benchmark shows it: its value and the number behind it, or
 * why it has none. The number is P(yes), the probability of the chosen kind, or
 * the score.
 * @param {string} key @param {AuditAnswer | undefined} answer
 */
function answerText(key, answer) {
  if (!answer) return "unanswered";
  if (!trusted(answer)) return `untrusted (mass ${answer.mass?.toFixed(2)})`;
  const type = BATTERY[key].type;
  const number = type === "noul" ? answer.noul : type === "score" ? answer.score : answer.probabilities?.[String(answer.choice)];
  const shown = typeof number === "number" ? ` (${number.toFixed(2)})` : "";
  const value = questionValue(key, answer);
  if (value !== undefined) return `${valueText(value)}${shown}`;
  return type === "score" && shown ? `off the scale${shown}` : "unanswered";
}

/** yes or no for a boolean; any other value as it is. @param {boolean | string} value */
function valueText(value) {
  return typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
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
    `can_fail agreement: ${verdict.correct}/${verdict.resolved} resolved (${percent(verdict.agreement)}). ` +
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
