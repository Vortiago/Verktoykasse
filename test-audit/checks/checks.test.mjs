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
import { BATTERY, CHECKS, ESCALATE_ON_FALSE, FLAG_BY_GATE, NEGATED, RUBRIC } from "./index.mjs";
import { CASE_FILE, CODE_FILE, LABEL_FILE, loadLabels } from "../calibration/labels.mjs";
import { extractTests } from "../change/index.mjs";
import { buildState } from "../classifier/index.mjs";
import { codeContext } from "../calibration/runner.mjs";

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

/** The label fields a label.json may hold. The loader adds `check`, `file` and `code`. */
const LABEL_FIELDS = new Set(["test", "defect", "canFail", "mustEscalate", "mixed", "deterministic", "note", "sources"]);

/**
 * The comment at the head of a file, as one line of words: the `//` lines
 * before the first line of code, without their markers.
 * @param {string} text
 */
function headerOf(text) {
  const lines = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("//")) break;
    lines.push(line.slice(2).trim());
  }
  return lines.join(" ").replace(/\s+/g, " ");
}

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

test("the battery asks each check's questions in check order, and no key twice", () => {
  const keys = CHECKS.flatMap((check) => Object.keys(check.questions));
  assert.equal(new Set(keys).size, keys.length, "a question key is defined twice");
  assert.deepEqual(Object.keys(BATTERY), keys);
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

test("the role tables hold every check of their role", () => {
  for (const check of CHECKS) {
    if (check.role === "gate") assert.deepEqual(ESCALATE_ON_FALSE[check.name], { keys: Object.keys(check.questions), reason: check.reason });
    if (check.role === "descriptive") assert.deepEqual(Object.keys(check.questions).map((key) => FLAG_BY_GATE[key]), [check.flag]);
    for (const key of check.negated ?? []) assert.ok(key in check.questions, `${check.name} negates ${key}, which it does not ask`);
  }
  assert.equal(Object.keys(ESCALATE_ON_FALSE).length, CHECKS.filter((check) => check.role === "gate").length);
  assert.equal(NEGATED.size, CHECKS.flatMap((check) => check.negated ?? []).length);
});

test("every check names its sources", () => {
  for (const check of CHECKS) {
    assert.ok(check.sources.length > 0, `${check.name} has no source`);
    for (const source of check.sources) {
      assert.ok(source.name.length > 0, `a source of ${check.name} has no name`);
      if (source.url !== undefined) assert.match(source.url, /^https?:\/\//, `${check.name}: ${source.url}`);
    }
  }
});

test("each check's header comment names every source in its `sources`, with the URL", () => {
  for (const check of CHECKS) {
    const header = headerOf(readFileSync(join(HERE, folderOf(check.name), "check.mjs"), "utf8"));
    assert.ok(header.includes("Sources:"), `${check.name} has no Sources: list in its header`);
    for (const source of check.sources) {
      assert.ok(header.includes(source.name), `${check.name}: the header does not name ${source.name}`);
      if (source.url) assert.ok(header.includes(source.url), `${check.name}: the header has no ${source.url}`);
    }
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
  const labels = loadLabels();
  for (const folder of CASES) {
    const [check, name] = folder.split("/");
    const file = `checks/${check}/cases/${name}/${CASE_FILE}`;
    const named = extractTests(readFileSync(join(HERE, "..", file), "utf8"), file).map((found) => found.name);
    const labelled = labels.filter((label) => label.file === file).map((label) => label.test);
    assert.ok(labelled.length > 0, `${folder} has no label`);
    assert.deepEqual([...named].sort(), [...labelled].sort(), `the tests in ${file} and their labels`);
    assert.equal(new Set(named).size, named.length, `two tests in ${file} share a name`);
  }
});

test("a label holds only the label fields, and names its defect", () => {
  for (const label of loadLabels()) {
    for (const key of Object.keys(label)) assert.ok(LABEL_FIELDS.has(key) || ["check", "file", "code"].includes(key), `${label.file}: field ${key}`);
    assert.ok(typeof label.defect === "string" && label.defect.length > 0, `${label.file}: no defect`);
  }
});

test("each case's header comment says what it shows and names the sources of its label", () => {
  for (const label of loadLabels()) {
    const header = headerOf(readFileSync(join(HERE, "..", label.file), "utf8"));
    assert.ok(header.length > 0, `${label.file} has no header comment`);
    assert.ok(label.sources?.length, `${label.file}: the label names no source`);
    for (const source of label.sources ?? []) {
      assert.ok(header.includes(`Source: ${source.name}`), `${label.file}: the header does not name ${source.name}`);
      if (source.url) assert.ok(header.includes(source.url), `${label.file}: the header has no ${source.url}`);
    }
  }
});

test("a case's header comment never reaches the model, and its code under test has no comment", () => {
  for (const label of loadLabels()) {
    const text = readFileSync(join(HERE, "..", label.file), "utf8");
    const test = extractTests(text, "example.test.mjs").find((found) => found.name === label.test);
    assert.ok(test, `${label.file}: no test ${label.test}`);
    const code = label.code ? readFileSync(join(HERE, "..", label.code), "utf8") : "";
    // The code under test travels whole, so a comment in it would reach the model.
    assert.ok(!/\/\/|\/\*/.test(code), `${label.code} holds a comment`);
    const state = buildState(test, code ? codeContext(code) : "", 1_000_000);
    for (const line of text.split("\n")) {
      if (!line.startsWith("//")) break;
      assert.ok(!state.includes(line.slice(2).trim()), `${label.file}: the state holds its header line ${line}`);
    }
  }
});
