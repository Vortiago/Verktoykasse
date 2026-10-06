// Unit tests for the check slices. Each folder in checks/ is one check, so these
// tests keep the folders, the battery, and the rubric in step. The battery and
// the rubric are what the model sees, so they must match the snapshots byte for
// byte. A change to a question or a definition is a calibration change: run the
// selftest, record it in BENCHMARK.md, then update the snapshot.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BATTERY, CHECKS, RUBRIC } from "./index.mjs";
import { CASE_FILE, CODE_FILE, LABEL_FIELDS, LABEL_FILE, LOADED_FIELDS, ROOT, headerOf, labelChecks, loadLabels, sourcesOf } from "../calibration/labels.mjs";
import { extractTests } from "../change/index.mjs";
import { buildState } from "../classifier/index.mjs";
import { NEUTRAL_TEST_PATH, prepareCase } from "../calibration/case-state.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The folders in checks/, sorted. */
const FOLDERS = readdirSync(HERE, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

/** Every case folder, as `<check>/<case>`, sorted. */
const CASES = FOLDERS.flatMap((folder) => {
  const cases = join(HERE, folder, "cases");
  if (!existsSync(cases)) return [];
  return readdirSync(cases).map((name) => `${folder}/${name}`);
}).sort();

/** Every label, loaded once. */
const LABELS = loadLabels();

/** The labels of each case file. */
const LABELS_BY_FILE = Map.groupBy(LABELS, (label) => label.file);

/** The text of each case file, and the tests the extractor finds in it, read once. */
const CASE_TEXTS = new Map(
  [...LABELS_BY_FILE.keys()].map((file) => {
    const text = readFileSync(join(ROOT, file), "utf8");
    return [file, { text, tests: extractTests(text, NEUTRAL_TEST_PATH) }];
  }),
);

/** The folder name of a check: the kebab-case form of its name. @param {string} name */
const folderOf = (name) => name.replaceAll("_", "-");

test("every check folder holds a check.mjs, and index.mjs lists each check once", () => {
  for (const folder of FOLDERS) assert.ok(existsSync(join(HERE, folder, "check.mjs")), `${folder}/ has no check.mjs`);
  assert.deepEqual(CHECKS.map((check) => folderOf(check.name)).sort(), FOLDERS);
});

test("the rubric is the snapshot, byte for byte", () => {
  assert.equal(`${RUBRIC}\n`, readFileSync(join(HERE, "rubric.snapshot.txt"), "utf8"));
});

test("the battery is the snapshot, byte for byte", () => {
  assert.equal(`${JSON.stringify(BATTERY, null, 2)}\n`, readFileSync(join(HERE, "battery.snapshot.json"), "utf8"));
});

test("a question key is its check's name, or the name and a phrasing letter", () => {
  for (const check of CHECKS) {
    for (const key of Object.keys(check.questions)) assert.match(key, new RegExp(`^${check.name}(_[a-z])?$`), `${key} in ${check.name}`);
  }
});

test("each rubric definition appears in the rubric once", () => {
  const defined = CHECKS.filter((check) => check.rubric);
  for (const check of defined) assert.equal(RUBRIC.split(String(check.rubric)).length, 2, `the ${check.name} definition`);
  assert.deepEqual(
    CHECKS.filter((check) => !check.rubric).map((check) => check.name),
    ["asserts", "name_matches"],
  );
});

test("a check negates only its own questions, and a descriptive check asks one question", () => {
  for (const check of CHECKS) {
    for (const key of check.negated ?? []) assert.ok(key in check.questions, `${check.name} negates ${key}, which it does not ask`);
    if (check.role === "descriptive") assert.deepEqual(Object.keys(check.questions), [check.name]);
  }
});

test("each check's header comment lists its sources, each with a URL or named as an inference", () => {
  for (const check of CHECKS) {
    const sources = sourcesOf(readFileSync(join(HERE, folderOf(check.name), "check.mjs"), "utf8"));
    assert.ok(sources.length > 0, `${check.name} has no Sources: list in its header`);
    for (const source of sources) assert.ok(source.url || source.name.includes("(inference)"), `${check.name}: ${source.name} has no URL`);
  }
});

test("every case folder holds a case.mjs and a label.json, and at most a code.mjs beside them", () => {
  assert.ok(CASES.length > 0);
  for (const folder of CASES) {
    const [check, name] = folder.split("/");
    const entries = readdirSync(join(HERE, check, "cases", name)).sort();
    assert.ok(entries.includes(CASE_FILE) && entries.includes(LABEL_FILE), `${folder} needs ${CASE_FILE} and ${LABEL_FILE}`);
    assert.deepEqual(entries.filter((entry) => ![CASE_FILE, LABEL_FILE, CODE_FILE].includes(entry)), [], `${folder} holds another file`);
  }
});

test("every label names a test in its case file, and every test in a case file has a label", () => {
  for (const folder of CASES) {
    const [check, name] = folder.split("/");
    const file = `checks/${check}/cases/${name}/${CASE_FILE}`;
    const named = CASE_TEXTS.get(file)?.tests.map((found) => found.name) ?? [];
    const labelled = LABELS_BY_FILE.get(file)?.map((label) => label.test) ?? [];
    assert.ok(labelled.length > 0, `${folder} has no label`);
    assert.deepEqual([...named].sort(), [...labelled].sort(), `the tests in ${file} and their labels`);
    assert.equal(new Set(named).size, named.length, `two tests in ${file} share a name`);
  }
});

test("a label holds only the label fields, and names its defect", () => {
  for (const label of LABELS) {
    for (const key of Object.keys(label)) assert.ok(LABEL_FIELDS.includes(key) || LOADED_FIELDS.includes(key), `${label.file}: field ${key}`);
    assert.ok(typeof label.defect === "string" && label.defect.length > 0, `${label.file}: no defect`);
  }
});

test("a check value in a label is one that check can give", () => {
  for (const label of LABELS) {
    for (const [name, value] of labelChecks(label)) {
      const check = CHECKS.find((candidate) => candidate.name === name);
      assert.ok(check, `${label.file}: no check ${name}`);
      /** @type {Array<boolean | string>} */
      const allowed =
        check.role === "asserts" ? Object.keys(check.kinds)
        : check.role === "verdict" ? check.levels
        : check.role === "type" ? Object.keys(Object.values(check.questions)[0].criteria)
        : [true, false];
      assert.ok(allowed.includes(value), `${label.file}: ${name} ${value} is not one of ${allowed.join(", ")}`);
    }
  }
});

test("each case's header comment says what it shows and names its sources, each with a URL", () => {
  for (const label of LABELS) {
    const header = headerOf(CASE_TEXTS.get(label.file)?.text ?? "");
    assert.ok(header.length > 0 && !header[0].startsWith(" Source:"), `${label.file}: the header does not say what the case shows`);
    assert.ok(label.sources?.length, `${label.file}: the header names no source`);
    for (const source of label.sources ?? []) assert.ok(source.url, `${label.file}: ${source.name} has no URL`);
  }
});

test("a case's header comment never reaches the model, and its code under test has no comment", () => {
  for (const label of LABELS) {
    const { test, code = "", context, error } = prepareCase(label);
    assert.ok(test, `${label.file}: no test ${label.test} (${error ?? "not found"})`);
    // The code under test travels whole, so a comment in it would reach the model.
    assert.ok(!/\/\/|\/\*/.test(code), `${label.code} holds a comment`);
    const state = buildState(test, context, 1_000_000);
    for (const line of headerOf(CASE_TEXTS.get(label.file)?.text ?? "")) {
      assert.ok(!state.includes(line.trim()), `${label.file}: the state holds its header line ${line}`);
    }
  }
});
