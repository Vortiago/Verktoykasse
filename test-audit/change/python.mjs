// The Python extractor: find the pytest and unittest tests in one file, with the
// fixtures, setup, imports, and markers the questions need. It reads the syntax
// only to find the test blocks, as the JavaScript extractor does; the questions
// judge the rest.
//
// A test is a `def test_*` (or `async def`) at module level, or a method of a
// class whose name starts with `Test` or whose bases name `TestCase`. A block
// ends at the first code line indented no deeper than its `def` or `class`.
// Strings, comments, and docstrings are blanked first, so a `def test_` inside a
// docstring is not a test.

/** @typedef {import("../types.d.ts").AuditTest} AuditTest */

/** A file named as a pytest or unittest test file: `test_*.py` or `*_test.py`. */
const PY_NAMED = /(?:^|[\\/])(?:test_[^\\/]*|[^\\/]*_test)\.py$/;
/** Any `.py` under a tests folder, but never conftest.py. */
const PY_IN_TESTS = /(?:^|[\\/])tests?[\\/](?:.*[\\/])?(?!conftest\.py$)[^\\/]+\.py$/;

/** A decorator or call that skips a test, or may skip it. */
const SKIP = /^@(?:pytest\.mark\.(?:skip|skipif)|unittest\.(?:skip|skipIf|skipUnless)|skip|skipIf|skipUnless)\b/;
/** A module-level marker that skips every test in the file. */
const MODULE_SKIP = /^pytestmark\s*=.*\bpytest\.mark\.(?:skip|skipif)\b/;
/** A decorator that runs one test over a table. */
const EACH = /^@(?:pytest\.mark\.parametrize|given)\b/;
/** The methods and functions that set up or tear down a test. */
const HOOK = /^(?:setUp|tearDown|setUpClass|tearDownClass|setup_method|teardown_method|setup_class|teardown_class|setup_module|teardown_module|setup_function|teardown_function|asyncSetUp|asyncTearDown)$/;

/** The longest setup one scope contributes to the state; a longer one is cut. */
const SETUP_CAP = 800;

/** Does this path name a Python test file? @param {string} path */
export function isPythonTestFile(path) {
  return PY_NAMED.test(path) || PY_IN_TESTS.test(path);
}

/** Is this path named as a Python test file, whatever folder it is in? @param {string} path */
export function isNamedPythonTestFile(path) {
  return PY_NAMED.test(path);
}

/**
 * Extract every test in one Python file's text.
 * @param {string} text
 * @param {string} file
 * @returns {AuditTest[]}
 */
export function extractPythonTests(text, file) {
  const lines = text.split("\n");
  const code = codeLines(text);
  const blocks = topBlocks(code, 0, lines.length, 0);
  const inBlocks = linesIn(blocks);
  const imports = importsOf(lines, code, inBlocks);
  const moduleSkipped = code.some((line) => MODULE_SKIP.test(line));
  const fixtures = blocks.filter((block) => block.kind === "def" && isFixture(block, code));
  // A helper is any module-level function or class the test may call that is
  // not itself a test, a test class, or a fixture.
  const helpers = blocks.filter((block) =>
    block.kind === "def" ? !block.name.startsWith("test") && !isFixture(block, code) : !isTestClass(block, code),
  );
  const moduleSetup = setupOf(lines, code, 0, lines.length, inBlocks);
  /** @type {AuditTest[]} */
  const out = [];
  for (const block of blocks) {
    if (block.kind === "def" && block.name.startsWith("test")) {
      out.push(testOf(lines, code, block, { file, path: [], scope: [], fixtures, hooks: [], helpers, setup: moduleSetup ? [moduleSetup] : [], imports, skipped: moduleSkipped }));
    } else if (block.kind === "class" && isTestClass(block, code)) {
      // The body's indent is that of its first code line; a blank line has none.
      const first = code.slice(block.bodyStart, block.end).find((line) => line.trim()) ?? "";
      const inner = topBlocks(code, block.bodyStart, block.end, indentOf(first));
      const classCtx = {
        file,
        path: [block.name],
        scope: [slice(lines, { ...block, end: block.bodyStart }).trimEnd()],
        fixtures: [...fixtures, ...inner.filter((item) => item.kind === "def" && isFixture(item, code))],
        hooks: inner.filter((item) => item.kind === "def" && HOOK.test(item.name)).map((item) => slice(lines, item)),
        helpers: [...helpers, ...inner.filter((item) => item.kind === "def" && !item.name.startsWith("test") && !HOOK.test(item.name) && !isFixture(item, code))],
        setup: [moduleSetup, setupOf(lines, code, block.bodyStart, block.end, linesIn(inner))].filter(Boolean),
        imports,
        skipped: moduleSkipped || decorators(code, block).some((line) => SKIP.test(line)),
      };
      for (const item of inner) if (item.kind === "def" && item.name.startsWith("test")) out.push(testOf(lines, code, item, classCtx));
    }
  }
  return out;
}

/**
 * One test record from a `def` block.
 * @param {string[]} lines @param {string[]} code
 * @param {Block} block
 * @param {{ file: string, path: string[], scope: string[], fixtures: Block[], hooks: string[], helpers: Block[], setup: string[], imports: string[], skipped: boolean }} ctx
 * @returns {AuditTest}
 */
function testOf(lines, code, block, ctx) {
  const source = slice(lines, block).trimEnd();
  // pytest passes a fixture by its parameter name, so a test needs only the
  // fixtures it names, the autouse ones, and the fixtures those name in turn.
  const fixtures = reach(lines, source, ctx.fixtures, (item) => decorators(code, item).some((line) => /autouse\s*=\s*True/.test(line)));
  const fixtureText = fixtures.map((item) => slice(lines, item));
  // A helper the test or its fixtures call is part of what the test does. The
  // state cap, sized for the endpoint, cuts what does not fit; the source comes
  // first in the record, so a cut never reaches the test.
  const helperText = reach(lines, [source, ...fixtureText].join("\n"), ctx.helpers, () => false).map((item) => slice(lines, item));
  const marks = decorators(code, block);
  /** @type {string[]} */
  const flags = [];
  if (marks.some((line) => EACH.test(line))) flags.push("each");
  if (ctx.skipped || marks.some((line) => SKIP.test(line))) flags.push("skipped");
  return {
    file: ctx.file,
    line: block.start + 1,
    name: block.name,
    path: ctx.path,
    scope: ctx.scope,
    source,
    fixtures: [...fixtureText, ...ctx.hooks],
    ...(ctx.setup.length || helperText.length ? { setup: [...ctx.setup, ...helperText] } : {}),
    imports: ctx.imports,
    flags,
  };
}

/**
 * A `def` or `class` block: from its first decorator to its last body line.
 * @typedef {{ kind: "def" | "class", name: string, start: number, head: number, bodyStart: number, end: number }} Block
 */

/**
 * The `def` and `class` blocks that start at exactly `indent` in lines
 * [from, to). A decorator run directly above a block belongs to it.
 * @param {string[]} code @param {number} from @param {number} to @param {number} indent
 * @returns {Block[]}
 */
function topBlocks(code, from, to, indent) {
  /** @type {Block[]} */
  const blocks = [];
  let decoratorStart = -1;
  for (let i = from; i < to; i += 1) {
    const line = code[i];
    if (!line.trim()) continue;
    const depth = indentOf(line);
    if (depth !== indent) {
      if (depth < indent) break;
      continue;
    }
    const text = line.trim();
    if (text.startsWith("@")) {
      if (decoratorStart === -1) decoratorStart = i;
      continue;
    }
    const match = /^(?:async\s+)?(def|class)\s+([A-Za-z_]\w*)/.exec(text);
    if (!match) {
      decoratorStart = -1;
      continue;
    }
    const head = i;
    const bodyStart = headEnd(code, head) + 1;
    const end = blockEnd(code, bodyStart, to, indent);
    blocks.push({ kind: /** @type {"def" | "class"} */ (match[1]), name: match[2], start: decoratorStart === -1 ? head : decoratorStart, head, bodyStart, end });
    decoratorStart = -1;
    i = end - 1;
  }
  return blocks;
}

/** The last line of a `def` or `class` head, which may span lines inside brackets. @param {string[]} code @param {number} head */
function headEnd(code, head) {
  let depth = 0;
  for (let i = head; i < code.length; i += 1) {
    for (const char of code[i]) {
      if ("([{".includes(char)) depth += 1;
      else if (")]}".includes(char)) depth -= 1;
    }
    if (depth <= 0 && /:\s*$/.test(code[i])) return i;
  }
  return head;
}

/** The line after a block's body: the first code line at or left of `indent`. @param {string[]} code @param {number} from @param {number} to @param {number} indent */
function blockEnd(code, from, to, indent) {
  let last = from - 1;
  for (let i = from; i < to; i += 1) {
    if (!code[i].trim()) continue;
    if (indentOf(code[i]) <= indent) break;
    last = i;
  }
  return last + 1;
}

/**
 * The blocks a text names, and the blocks those name in turn, in file order.
 * `always` adds a block whether or not it is named.
 * @param {string[]} lines @param {string} text @param {Block[]} candidates @param {(block: Block) => boolean} always
 */
function reach(lines, text, candidates, always) {
  const found = new Set(candidates.filter((block) => always(block) || names(text, block.name)));
  for (let grew = true; grew; ) {
    grew = false;
    const known = [...found].map((block) => slice(lines, block)).join("\n");
    for (const block of candidates) {
      if (!found.has(block) && names(known, block.name)) {
        found.add(block);
        grew = true;
      }
    }
  }
  return candidates.filter((block) => found.has(block));
}

/** Does the text use this name as a whole word? @param {string} text @param {string} name */
function names(text, name) {
  return new RegExp(`(?<![\\w.])${name}\\b`).test(text);
}

/** The decorator lines of a block, trimmed. @param {string[]} code @param {Block} block */
function decorators(code, block) {
  return code.slice(block.start, block.head).map((line) => line.trim()).filter((line) => line.startsWith("@"));
}

/** A pytest fixture: a function decorated with `@pytest.fixture` or `@fixture`. @param {Block} block @param {string[]} code */
function isFixture(block, code) {
  return decorators(code, block).some((line) => /^@(?:pytest\.)?fixture\b/.test(line));
}

/** A class pytest or unittest collects: named `Test*`, or based on a `TestCase`. @param {Block} block @param {string[]} code */
function isTestClass(block, code) {
  if (/^Test/.test(block.name)) return true;
  const head = code.slice(block.head, block.bodyStart).join(" ");
  return /\(\s*[^)]*\bTestCase\b/.test(head);
}

/** The lines inside any of the blocks. @param {Block[]} blocks */
function linesIn(blocks) {
  return new Set(blocks.flatMap((block) => range(block.start, block.end)));
}

/** The import statements at module level, each whole. @param {string[]} lines @param {string[]} code @param {Set<number>} inBlock */
function importsOf(lines, code, inBlock) {
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < code.length; i += 1) {
    if (inBlock.has(i) || indentOf(code[i]) !== 0 || !/^(?:import|from)\s/.test(code[i])) continue;
    let end = i;
    if (code[i].includes("(") && !code[i].includes(")")) while (end < code.length - 1 && !code[end].includes(")")) end += 1;
    out.push(lines.slice(i, end + 1).join("\n"));
    i = end;
  }
  return out;
}

/**
 * The code of one scope outside its `def` and `class` blocks and its imports:
 * the constants and shared objects the tests read. Capped.
 * @param {string[]} lines @param {string[]} code @param {number} from @param {number} to @param {Set<number>} inBlock
 */
function setupOf(lines, code, from, to, inBlock) {
  const kept = [];
  for (let i = from; i < to; i += 1) {
    if (inBlock.has(i) || !code[i].trim() || /^\s*(?:import|from)\s/.test(code[i])) continue;
    kept.push(lines[i]);
  }
  const text = kept.join("\n").trim();
  return text.length > SETUP_CAP ? `${text.slice(0, SETUP_CAP)}\n# … [setup truncated]` : text;
}

/** The text of a block. @param {string[]} lines @param {{ start: number, end: number }} block */
function slice(lines, block) {
  return lines.slice(block.start, block.end).join("\n");
}

/** @param {string} line */
function indentOf(line) {
  return line.length - line.trimStart().length;
}

/** @param {number} from @param {number} to */
function range(from, to) {
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
}

/**
 * The file's lines with every comment and string body blanked to spaces, so the
 * block scan sees only code. A line that starts inside a triple-quoted string
 * is blanked whole: its indentation means nothing to Python, and its closing
 * quotes must not end the block around it.
 * @param {string} text
 * @returns {string[]}
 */
function codeLines(text) {
  let out = "";
  /** @type {string | null} */
  let quote = null;
  /** The lines, by index, that start inside a triple-quoted string. */
  const inside = new Set();
  let line = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (i > 0 && text[i - 1] === "\n") {
      line += 1;
      if (quote && quote.length === 3) inside.add(line);
    }
    const char = text[i];
    if (quote) {
      if (char === "\\" && i + 1 < text.length) {
        out += text[i + 1] === "\n" ? " \n" : "  ";
        i += 1;
      } else if (text.startsWith(quote, i)) {
        out += quote;
        i += quote.length - 1;
        quote = null;
      } else if (char === "\n" && quote.length === 1) {
        out += "\n";
        quote = null;
      } else out += char === "\n" ? "\n" : " ";
    } else if (char === "#") {
      while (i < text.length && text[i] !== "\n") {
        out += " ";
        i += 1;
      }
      if (i < text.length) out += "\n";
    } else if (char === '"' || char === "'") {
      quote = text.startsWith(char.repeat(3), i) ? char.repeat(3) : char;
      out += quote;
      i += quote.length - 1;
    } else out += char;
  }
  return out.split("\n").map((row, index) => (inside.has(index) ? "" : row));
}
