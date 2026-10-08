// Unit tests for the Python extractor: which functions are tests, what each
// record carries, and the markers it flags.

import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTests, isTestFile } from "./index.mjs";

test("a pytest or unittest file is a test file, and conftest.py is not", () => {
  for (const path of ["tests/test_text.py", "pkg/text_test.py", "tests/unit/helpers.py", "test_a.py"]) assert.ok(isTestFile(path), path);
  for (const path of ["tests/conftest.py", "src/text.py", "src/testing.py"]) assert.equal(isTestFile(path), false, path);
});

test("module-level test functions, async ones too, are tests; a helper is not", () => {
  const text = ["import pytest", "", "def helper():", "    return 1", "", "def test_adds():", "    assert add(1, 1) == 2", "", "async def test_fetches():", "    assert await fetch() == 1", ""].join("\n");
  const found = extractTests(text, "tests/test_a.py");
  assert.deepEqual(
    found.map((t) => [t.name, t.line]),
    [["test_adds", 6], ["test_fetches", 9]],
  );
  assert.equal(found[0].source, "def test_adds():\n    assert add(1, 1) == 2");
  assert.deepEqual(found[0].imports, ["import pytest"]);
});

test("a method of a Test class or a TestCase is a test, with the class head as scope and setUp as a fixture", () => {
  const text = [
    "import unittest",
    "",
    "class TestParser:",
    "    def test_splits(self):",
    "        assert split('a.b') == ['a', 'b']",
    "",
    "class ParserCase(unittest.TestCase):",
    "    def setUp(self):",
    "        self.p = Parser()",
    "",
    "    def test_parses(self):",
    "        self.assertEqual(self.p.parse('1'), 1)",
    "",
    "class _Fake:",
    "    def test_not_a_test(self):",
    "        pass",
  ].join("\n");
  const found = extractTests(text, "tests/test_p.py");
  assert.deepEqual(
    found.map((t) => [t.name, t.path]),
    [["test_splits", ["TestParser"]], ["test_parses", ["ParserCase"]]],
  );
  assert.deepEqual(found[1].scope, ["class ParserCase(unittest.TestCase):"]);
  assert.ok(found[1].fixtures.some((fixture) => fixture.includes("def setUp")));
});

test("a pytest fixture travels with each test, and module constants are setup", () => {
  const text = ["import pytest", "", "LIMIT = 64", "", "@pytest.fixture", "def store(tmp_path):", "    return Store(tmp_path)", "", "def test_keeps(store):", "    store.put('a', 1)", "    assert store.get('a') == 1"].join("\n");
  const [found] = extractTests(text, "tests/test_s.py");
  assert.deepEqual(found.fixtures, ["@pytest.fixture\ndef store(tmp_path):\n    return Store(tmp_path)"]);
  assert.deepEqual(found.setup, ["LIMIT = 64"]);
});

test("skip markers and parametrize become flags, and the decorators stay in the source", () => {
  const text = [
    "import pytest",
    "",
    "@pytest.mark.skip(reason='later')",
    "def test_a():",
    "    assert a() == 1",
    "",
    "@pytest.mark.parametrize('x', [1, 2])",
    "def test_b(x):",
    "    assert b(x) > 0",
    "",
    "@pytest.mark.skipif(sys.platform == 'win32', reason='posix')",
    "class TestC:",
    "    def test_c(self):",
    "        assert c() == 1",
  ].join("\n");
  const found = extractTests(text, "tests/test_m.py");
  assert.deepEqual(
    found.map((t) => [t.name, t.flags]),
    [["test_a", ["skipped"]], ["test_b", ["each"]], ["test_c", ["skipped"]]],
  );
  assert.match(found[0].source, /^@pytest\.mark\.skip/);
});

test("a module-level pytestmark skip marks every test in the file", () => {
  const text = ["import pytest", "pytestmark = pytest.mark.skip(reason='slow')", "", "def test_a():", "    assert a() == 1"].join("\n");
  assert.deepEqual(extractTests(text, "tests/test_x.py")[0].flags, ["skipped"]);
});

test("a def test_ inside a docstring or a comment is not a test, and a multi-line head is one test", () => {
  const text = [
    '"""Examples:',
    "",
    "def test_in_docstring():",
    "    pass",
    '"""',
    "# def test_in_comment():",
    "",
    "def test_real(",
    "    tmp_path,",
    "    store,",
    "):",
    '    text = """',
    "def test_inside_string():",
    '"""',
    "    assert store.read(text) == text",
  ].join("\n");
  const found = extractTests(text, "tests/test_d.py");
  assert.deepEqual(
    found.map((t) => [t.name, t.line]),
    [["test_real", 8]],
  );
  assert.match(found[0].source, /assert store\.read\(text\) == text$/);
});

test("a test class whose body starts with a blank line still yields its tests", () => {
  const text = ["class TestA:", "", "    def test_x(self):", "        assert x() == 1"].join("\n");
  assert.deepEqual(extractTests(text, "tests/test_a.py").map((t) => t.name), ["test_x"]);
});
