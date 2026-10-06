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

const HERE = dirname(fileURLToPath(import.meta.url));

/** The folders in checks/, sorted. */
const FOLDERS = readdirSync(HERE, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

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
