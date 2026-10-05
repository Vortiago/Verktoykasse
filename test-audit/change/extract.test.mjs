// Unit tests for the parse half. Every case is a string, so no git and no
// network: the same property that lets cli.mjs feed it a diff in production.

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTests, isTestFile, splitDiff, changeContext } from "./extract.mjs";

test("isTestFile accepts the runners' naming conventions", () => {
  assert.equal(isTestFile("src/add.test.js"), true);
  assert.equal(isTestFile("src/add.test.mjs"), true);
  assert.equal(isTestFile("src/add.spec.ts"), true);
  assert.equal(isTestFile("src/add.spec.tsx"), true);
  assert.equal(isTestFile("src/__tests__/add.js"), true);
  assert.equal(isTestFile("src/add.js"), false);
  assert.equal(isTestFile("src/test-helpers.js"), false);
});

test("extractTests reads a test with its name and line", () => {
  const tests = extractTests('test("add handles negatives", () => {\n  expect(add(-2, -3)).toBe(-5);\n});\n', "add.test.mjs");
  assert.equal(tests.length, 1);
  assert.equal(tests[0].name, "add handles negatives");
  assert.equal(tests[0].line, 1);
  assert.match(tests[0].body, /toBe\(-5\)/);
  assert.equal(tests[0].source.startsWith("test("), true);
});

test("extractTests nests a describe chain and keeps fixtures in scope", () => {
  const text = [
    'describe("math", () => {',
    "  beforeEach(() => reset());",
    '  describe("add", () => {',
    '    it("works", () => { expect(add(1, 1)).toBe(2); });',
    "  });",
    "});",
  ].join("\n");
  const [found] = extractTests(text, "math.test.mjs");
  assert.deepEqual(found.path, ["math", "add"]);
  assert.equal(found.fixtures.length, 1);
  assert.match(found.fixtures[0], /beforeEach/);
});

test("extractTests records a skip member on the test", () => {
  const [found] = extractTests('test.skip("later", () => { expect(1).toBe(1); });\n', "x.test.mjs");
  assert.equal(found.name, "later");
  assert.match(found.source, /^test\.skip/);
});

test("extractTests folds a test.each table into one test", () => {
  const [found] = extractTests('test.each([1, 2])("n %i", (n) => { expect(n).toBeGreaterThan(0); });\n', "x.test.mjs");
  assert.equal(found.name, "n %i");
  assert.deepEqual(found.flags, ["each"]);
  assert.match(found.body, /toBeGreaterThan/);
});

test("extractTests flags a computed name", () => {
  const [found] = extractTests('test("case " + n, () => { expect(1).toBe(1); });\n', "x.test.mjs");
  assert.equal(found.name, "(dynamic name)");
  assert.ok(found.flags.includes("dynamic-name"));
});

test("extractTests collects the file imports", () => {
  const [found] = extractTests('import { add } from "../add.js";\ntest("a", () => expect(add(1, 1)).toBe(2));\n', "x.test.mjs");
  assert.deepEqual(found.imports, ['import { add } from "../add.js";']);
});

test("extractTests ignores a test call inside a string or a comment", () => {
  const text = [
    'const fixture = `test("fake", () => { expect(1).toBe(1); });`;',
    '// test("commented", () => {});',
    'test("real", () => { expect(1).toBe(1); });',
  ].join("\n");
  assert.deepEqual(
    extractTests(text, "x.test.mjs").map((found) => found.name),
    ["real"],
  );
});

test("a regex literal does not hide the tests after it", () => {
  const text = [
    `test("first", () => { expect(x).toMatch(/["']/); expect(y).toMatch(/[)]/); });`,
    `test("second", () => { expect(z).toBe(1); });`,
  ].join("\n");
  assert.deepEqual(
    extractTests(text, "x.test.mjs").map((found) => found.name),
    ["first", "second"],
  );
});

test("a call head inside a regex is not a test", () => {
  const text = 'const re = /it(eration)?/;\ntest("real", () => { expect(1).toBe(1); });';
  assert.deepEqual(
    extractTests(text, "x.test.mjs").map((found) => found.name),
    ["real"],
  );
});

test("a test right after an opening brace is found", () => {
  const text = 'describe("d", () => {test("a", () => { expect(1).toBe(1); });});';
  assert.deepEqual(
    extractTests(text, "x.test.mjs").map((found) => found.name),
    ["a"],
  );
});

test("an expression-bodied test keeps its body", () => {
  const [found] = extractTests('test("a", () => expect(x).toBe(1));', "x.test.mjs");
  assert.equal(found.body.trim(), "expect(x).toBe(1)");
});

test("splitDiff separates the per-file sections", () => {
  const diff = ["diff --git a/src/add.js b/src/add.js", "@@ -1 +1 @@", "-a", "+b", "diff --git a/src/add.test.js b/src/add.test.js", "@@ -0 +1 @@", "+test"].join("\n");
  const sections = splitDiff(diff);
  assert.deepEqual(
    sections.map((section) => section.path),
    ["src/add.js", "src/add.test.js"],
  );
  assert.match(sections[0].text, /^-a/m);
  assert.match(sections[1].text, /\+test/);
});

test("changeContext keeps the non-test sections and caps", () => {
  const diff = ["diff --git a/src/add.js b/src/add.js", "+const x = 1;", "diff --git a/src/add.test.js b/src/add.test.js", "+test"].join("\n");
  assert.equal(changeContext(diff, 10_000), "+const x = 1;");
  assert.match(changeContext(diff, 4), /context truncated/);
});

test("an unterminated call does not stop the scan", () => {
  const text = 'test("broken", () => { expect(1).toBe(1);\ntest("after", () => { expect(2).toBe(2); });';
  assert.deepEqual(
    extractTests(text, "x.test.mjs").map((found) => found.name),
    ["after"],
  );
});
