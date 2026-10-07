// Unit tests for the parse half. Every case is a string, so no git and no
// network: the same property that lets cli.mjs feed it a diff in production.

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTests, isTestFile, splitDiff, changeContext, changedTests } from "./extract.mjs";

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
  assert.match(tests[0].source, /toBe\(-5\)/);
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
  assert.match(found.source, /toBeGreaterThan/);
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

test("a test name with a comma or a regex is read whole", () => {
  const [found] = extractTests('test("splits a, b", () => expect(split(/,/)).toEqual(["a", "b"]));', "x.test.mjs");
  assert.equal(found.name, "splits a, b");
});

test("a test on a later line reports that line", () => {
  const found = extractTests('test("a", () => {});\n\n\ntest("b", () => {});\n', "x.test.mjs");
  assert.deepEqual(found.map((t) => t.line), [1, 4]);
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

test("a JSX closing tag is not a regex, so the test that holds it is found", () => {
  const text = [
    'test("renders the label", () => {',
    "  render(<Button>Save</Button>);",
    '  expect(screen.getByRole("button")).toHaveTextContent("Save");',
    "});",
    'test("renders a fragment", () => {',
    "  render(<>x</>);",
    '  expect(screen.getByText("x")).toBeVisible();',
    "});",
    'test("renders a counter", () => {',
    "  render(<Counter initial={0} />);",
    '  expect(screen.getByRole("status")).toHaveTextContent("0");',
    "});",
  ].join("\n");
  assert.deepEqual(
    extractTests(text, "x.test.tsx").map((found) => found.name),
    ["renders the label", "renders a fragment", "renders a counter"],
  );
});

test("a postfix operator before a slash is division, not a regex", () => {
  const text = [
    'test("averages", () => {',
    "  expect(total! / count).toBe(2);",
    "  expect(`${i++ / 2}`).toBe(\"0.5\");",
    "});",
    'test("after", () => { expect(1).toBe(1); });',
  ].join("\n");
  assert.deepEqual(
    extractTests(text, "x.test.ts").map((found) => found.name),
    ["averages", "after"],
  );
});

test("a regex that opens a CRLF line is still a regex", () => {
  const text = 'test("throws", () => {\r\n  expect(() => f()).toThrow(\r\n    /unclosed \\(/,\r\n  );\r\n});\r\ntest("after", () => { expect(1).toBe(1); });\r\n';
  assert.deepEqual(
    extractTests(text, "x.test.mjs").map((found) => found.name),
    ["throws", "after"],
  );
});

test("a test carries the heads of its enclosing describes", () => {
  const text = 'describe.skip("math", () => {\n  describe("add", () => {\n    it("adds", () => { expect(add(1, 2)).toBe(3); });\n  });\n});';
  const [found] = extractTests(text, "x.test.mjs");
  assert.deepEqual(found.path, ["math", "add"]);
  assert.deepEqual(found.scope, ['describe.skip("math", () => {', 'describe("add", () => {']);
});

test("a focus marker anywhere notes every test in the file", () => {
  const text = 'it.only("saves", () => { expect(save()).toBe(true); });\nit("loads", () => { expect(load()).toBe(1); });';
  assert.deepEqual(
    extractTests(text, "x.test.mjs").map((found) => found.flags),
    [["focus-in-file"], ["focus-in-file"]],
  );
  assert.deepEqual(extractTests('it("loads", () => { expect(load()).toBe(1); });', "x.test.mjs")[0].flags, []);
});

test("a skip marker on the test or on a describe around it notes the test as skipped", () => {
  const text = [
    'test.skip("a", () => { expect(a()).toBe(1); });',
    'xit("b", () => { expect(b()).toBe(1); });',
    'test.todo("c");',
    'describe.skip("d", () => { it("inner", () => { expect(d()).toBe(1); }); });',
    'test("e", () => { expect(e()).toBe(1); });',
  ].join("\n");
  assert.deepEqual(
    extractTests(text, "x.test.mjs").map((found) => [found.name, found.flags.includes("skipped")]),
    [["a", true], ["b", true], ["c", true], ["inner", true], ["e", false]],
  );
});

test("a chained or curried call head is still a test", () => {
  const text = [
    'test.skip.each([[1, 2]])("adds %i", (a, b) => { expect(a + 1).toBe(b); });',
    'test.skipIf(isWindows)("reads a link", () => { expect(read()).toBe("x"); });',
    'it.concurrent("runs at once", async () => { expect(await f()).toBe(1); });',
  ].join("\n");
  const found = extractTests(text, "x.test.mjs");
  assert.deepEqual(found.map((t) => t.name), ["adds %i", "reads a link", "runs at once"]);
  assert.deepEqual(found[0].flags, ["each", "skipped"]);
  assert.deepEqual(found[1].flags, ["skipped"]);
  assert.deepEqual(found[2].flags, []);
  assert.match(found[0].source, /^test\.skip\.each/);
});

test("a describe with an expression body still yields its test", () => {
  const [found] = extractTests('describe("d", () => test("a", () => { expect(1).toBe(1); }));', "x.test.mjs");
  assert.equal(found?.name, "a");
  assert.deepEqual(found?.path, ["d"]);
});

test("changedTests keeps only the tests whose lines the diff adds or edits", () => {
  const text = 'test("old one", () => {\n  expect(add(1, 1)).toBe(2);\n});\n\ntest("old two", () => {\n  expect(add(2, 3)).toBe(5);\n});\n\ntest("new three", () => {\n  expect(add(3, 3)).toBe(6);\n});\n';
  const tests = extractTests(text, "add.test.mjs");
  const diff = [
    "diff --git a/add.test.mjs b/add.test.mjs",
    "--- a/add.test.mjs",
    "+++ b/add.test.mjs",
    "@@ -5,3 +5,3 @@",
    ' test("old two", () => {',
    "-  expect(add(2, 2)).toBe(4);",
    "+  expect(add(2, 3)).toBe(5);",
    " });",
    "@@ -7,0 +8,4 @@",
    "+",
    '+test("new three", () => {',
    "+  expect(add(3, 3)).toBe(6);",
    "+});",
  ].join("\n");
  assert.deepEqual(changedTests(tests, diff).map((test) => test.name), ["old two", "new three"]);
  // A file the diff does not name (untracked, or named on the command line) counts whole.
  assert.deepEqual(changedTests(tests, "").map((test) => test.name), ["old one", "old two", "new three"]);
  // A rename with no hunk adds no test.
  assert.deepEqual(changedTests(tests, "diff --git a/old.test.mjs b/add.test.mjs\nsimilarity index 100%\nrename from old.test.mjs\nrename to add.test.mjs").length, 0);
});

test("suite and node:test's before and after are a describe and its hooks", () => {
  const text = [
    'suite.skip("clock", () => {',
    "  beforeEach(() => mock.timers.enable());",
    '  test("ticks", () => { assert.equal(tick(), 1); });',
    "});",
    'suite("tokens", () => {',
    '  before(() => { process.env.SECRET = "x"; });',
    '  test("reads", () => { assert.equal(read(), "x"); });',
    "});",
  ].join("\n");
  const [ticks, reads] = extractTests(text, "x.test.mjs");
  assert.deepEqual([ticks.path, reads.path], [["clock"], ["tokens"]]);
  assert.match(ticks.scope[0], /^suite\.skip/);
  assert.match(ticks.fixtures.join(""), /mock\.timers/);
  assert.match(reads.fixtures.join(""), /^before\(/);
});

test("a function or method named after a call head is not a test", () => {
  const text = 'function it(name, fn) { return fn(); }\nconst matcher = { test(value) { return value > 0; } };\ntest("real", () => { expect(1).toBe(1); });';
  assert.deepEqual(
    extractTests(text, "x.test.mjs").map((found) => found.name),
    ["real"],
  );
});

test("isTestFile accepts the mocha and node:test defaults", () => {
  assert.equal(isTestFile("test/slug.mjs"), true);
  assert.equal(isTestFile("tests/unit/slug.js"), true);
  assert.equal(isTestFile("src/slug-test.js"), true);
  assert.equal(isTestFile("src/slug_test.ts"), true);
  assert.equal(isTestFile("test/fixtures/data.json"), false);
  assert.equal(isTestFile("src/contest/slug.js"), false);
});

test("mocha's context and specify are a describe and a test", () => {
  const text = `describe("cart", () => {
  context("when empty", () => {
    beforeEach(() => { cart.clear(); });
    it("has no total", () => { expect(cart.total).toBe(0); });
  });
  it("adds an item", () => { cart.add(1); expect(cart.size).toBe(1); });
  specify("removes an item", () => { cart.remove(1); expect(cart.size).toBe(0); });
});`;
  const tests = extractTests(text, "cart.test.js");
  assert.deepEqual(tests.map((t) => [t.name, t.path, t.fixtures.length]), [
    ["has no total", ["cart", "when empty"], 1],
    ["adds an item", ["cart"], 0],
    ["removes an item", ["cart"], 0],
  ]);
});

test("a keyword read as a property is a value, so the slash after it is division", () => {
  const text = `it("ratio", () => { const r = stats.new / total; expect(r).toBe(0.5); });
it("matches", () => { expect(/a\\)/.test("a)")).toBe(true); });`;
  assert.deepEqual(extractTests(text, "stats.test.js").map((t) => t.name), ["ratio", "matches"]);
});

test("a test carries the setup code of each scope around it, without imports or comments", () => {
  const text = `// A header comment the model must not see.
import { Registry } from "./registry.mjs";
const registry = new Registry();
const EXPECTED = { major: 1 };
describe("versions", () => {
  let parsed;
  beforeEach(() => { parsed = parse("1.0.0"); });
  it("reads the major part", () => {
    expect(parsed).toEqual(EXPECTED);
  });
});
test("dispatches", () => { expect(registry.dispatch("ping")).toBe("pong"); });`;
  const [inner, outer] = extractTests(text, "a.test.js");
  assert.deepEqual(inner.setup, ["const registry = new Registry();\nconst EXPECTED = { major: 1 };", "let parsed;"]);
  assert.deepEqual(outer.setup, ["const registry = new Registry();\nconst EXPECTED = { major: 1 };"]);
  assert.equal(extractTests('test("a", () => { expect(1).toBe(1); });', "a.test.js")[0].setup, undefined);
});
