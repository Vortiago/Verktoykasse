// Test extraction: the parse half of the audit. It takes the text of one file
// and returns the test blocks inside it. No git, no filesystem, no network, so
// a fixture string exercises every branch. The read half lives in collect.mjs.
//
// The scanner reuses the quote/backtick-aware helpers from tools/js-scan.mjs:
// `argSpan` walks to the matching bracket of a call, and `splitTop` splits the
// argument list on its top-level commas.

import { argSpan, splitTop } from "../tools/js-scan.mjs";
import { codeOnly } from "./code-only.mjs";

/** @typedef {import("../types.d.ts").AuditTest} AuditTest */

/** A path is a test file when it ends in .test./.spec. or sits under __tests__. */
const TEST_FILE = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$)|(?:^|[\\/])__tests__[\\/]/;

/** The call heads that open a scope or a test: a keyword and its `.member`
 * chain, such as `test.skip.each` or `it.concurrent`. */
const CALL =
  /(^|[^\w$.])(xdescribe|fdescribe|describe|suite|xit|xtest|fit|test|it|beforeEach|beforeAll|afterEach|afterAll|before|after)((?:\.(?:skip|only|each|for|todo|concurrent|failing|fails|sequential|skipIf|runIf))*)\s*\(/;

/** Members whose first call takes a table or a condition and returns the test
 * function, so the test is the second call: `test.each([...])("name", fn)`. */
const CURRIED = new Set(["each", "for", "skipIf", "runIf"]);

/** The second call of a curried head, matched right where the first ends. */
const EACH_CALL = /\s*\(/y;

/** The longest describe head the state carries; a longer one is cut. */
const HEAD_CAP = 160;

/** `suite`, `before` and `after` are node:test's names for a describe and its hooks. */
const DESCRIBES = new Set(["describe", "xdescribe", "fdescribe", "suite"]);
const TESTS = new Set(["test", "it", "xit", "xtest", "fit"]);
const FIXTURES = new Set(["beforeEach", "beforeAll", "afterEach", "afterAll", "before", "after"]);

/**
 * Does this path name a test file? The read half uses it to filter a change;
 * `extractTests` does not, so a fixture string needs no filename.
 * @param {string} path
 */
export function isTestFile(path) {
  return TEST_FILE.test(path);
}

/**
 * Extract every test in one file's text.
 * @param {string} text
 * @param {string} file
 * @returns {AuditTest[]}
 */
export function extractTests(text, file) {
  /** @type {AuditTest[]} */
  const out = [];
  // The code-only view and the line index are one scan per file, not one per
  // describe scope or per test.
  const code = codeOnly(text);
  const ctx = { file, imports: extractImports(text), lineStarts: lineStarts(text), out, focused: false };
  walk(text, code, 0, text.length, [], [], [], ctx);
  // An only or focus marker anywhere narrows the whole run, so every test in the
  // file carries the note, and `runs` can see it beside a plain sibling test.
  if (ctx.focused) for (const test of out) test.flags.push("focus-in-file");
  return out;
}

/** The offset where each line starts, so a line lookup is a binary search. @param {string} text */
function lineStarts(text) {
  const starts = [0];
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) starts.push(i + 1);
  return starts;
}

/** The 1-based line of an offset. @param {number[]} starts @param {number} offset */
function lineAt(starts, offset) {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return low + 1;
}

/**
 * Walk one scope's region: collect its fixtures, recurse into each describe,
 * and record each test. `findCalls` skips nested calls, so recursion is the
 * only path into a describe body.
 * @param {string} text
 * @param {string} code
 * @param {number} start
 * @param {number} end
 * @param {string[]} path
 * @param {string[]} inherited
 * @param {string[]} heads the enclosing describes' call heads, outermost first
 * @param {{ file: string, imports: string[], lineStarts: number[], out: AuditTest[], focused: boolean }} ctx
 */
function walk(text, code, start, end, path, inherited, heads, ctx) {
  const calls = findCalls(code, text, start, end);
  const fixtures = calls.filter((c) => FIXTURES.has(c.keyword)).map((c) => text.slice(c.callStart, c.callEnd));
  const scope = [...inherited, ...fixtures];
  for (const call of calls) {
    if (call.focused) ctx.focused = true;
    if (DESCRIBES.has(call.keyword)) {
      // The head (`describe.skip("parser", () => {`) travels with each test
      // inside, so a skip or only on the describe reaches the `runs` question.
      if (call.body) walk(text, code, call.body.start, call.body.end, [...path, call.name], scope, [...heads, headOf(text, call.callStart, call.body.start)], ctx);
      continue;
    }
    if (!TESTS.has(call.keyword)) continue;
    const flags = [];
    if (call.dynamicName) flags.push("dynamic-name");
    if (call.members.includes("each") || call.members.includes("for")) flags.push("each");
    ctx.out.push({
      file: ctx.file,
      line: lineAt(ctx.lineStarts, call.callStart),
      name: call.name,
      path: [...path],
      scope: heads,
      source: text.slice(call.callStart, call.callEnd),
      fixtures: scope,
      imports: ctx.imports,
      flags,
    });
  }
}

/**
 * A describe's head, from its keyword to the start of its body, capped.
 * @param {string} text @param {number} start @param {number} end
 */
function headOf(text, start, end) {
  const head = text.slice(start, end).trim();
  return head.length > HEAD_CAP ? `${head.slice(0, HEAD_CAP - 1)}…` : head;
}

/** The head of a per-file section in a unified diff. */
const DIFF_FILE = /^diff --git a\/(.+?) b\/(.+)$/;

/**
 * The diff with its test-file sections removed: the reviewer's questions are
 * about the test, so the non-test part is the useful context.
 * @param {string} diff
 * @param {number} cap
 */
export function changeContext(diff, cap) {
  const text = splitDiff(diff)
    .filter((section) => !isTestFile(section.path))
    .map((section) => section.text)
    .join("\n");
  return text.length > cap ? `${text.slice(0, cap)}\n… [context truncated]` : text;
}

/** A hunk header: where its new-side lines start. */
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * The tests a diff adds or edits: those with a changed line in their span. A
 * file the diff does not name (untracked, or named on the command line) is new
 * to the audit, so every test in it counts.
 * @param {AuditTest[]} tests
 * @param {string} diff
 */
export function changedTests(tests, diff) {
  const changed = new Map(splitDiff(diff).map((section) => [section.path, changedLines(section.text)]));
  return tests.filter((test) => {
    const lines = changed.get(test.file);
    if (!lines) return true;
    const last = test.line + (test.source.match(/\n/g)?.length ?? 0);
    for (let line = test.line; line <= last; line += 1) if (lines.has(line)) return true;
    return false;
  });
}

/**
 * The new-side lines one file's hunks add, plus the line after each deletion,
 * so a test that only lost lines still counts as edited.
 * @param {string} text
 */
function changedLines(text) {
  /** @type {Set<number>} */
  const lines = new Set();
  let line = 0;
  for (const row of text.split("\n")) {
    const hunk = HUNK.exec(row);
    if (hunk) line = Number(hunk[1]);
    else if (line === 0) continue;
    else if (row.startsWith("+")) lines.add(line++);
    else if (row.startsWith("-")) lines.add(line);
    else if (row.startsWith(" ")) line += 1;
  }
  return lines;
}

/**
 * Split a unified diff into its per-file sections. The read half owns the git
 * call; this parse turns the diff text into `{ path, text }` sections so a
 * caller can carry the non-test part as context.
 * @param {string} diff
 * @returns {Array<{ path: string, text: string }>}
 */
export function splitDiff(diff) {
  const sections = [];
  /** @type {{ path: string, lines: string[] } | undefined} */
  let current;
  for (const line of diff.split("\n")) {
    const start = DIFF_FILE.exec(line);
    if (start) {
      current = { path: start[2], lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return sections.map((section) => ({ path: section.path, text: section.lines.join("\n") }));
}

/**
 * Every test/describe/hook call at the top level of `[start, end)`. A call's
 * whole span is skipped, so a nested describe's tests are found only when the
 * caller recurses into its body.
 * @param {string} code
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @returns {Array<{ keyword: string, members: string[], focused: boolean, name: string, dynamicName: boolean, callStart: number, callEnd: number, body: {start: number, end: number} | null }>}
 */
function findCalls(code, text, start, end) {
  // Scan the code-only view: comments, string, template, and regex bodies are
  // blanked with offsets preserved, so a `test(...)` inside a fixture string or
  // a regex is not mistaken for a real test. Spans are matched on the same view
  // (its literals keep their delimiters), and text is sliced from the original.
  // `start - 1` lets the boundary group see the enclosing brace.
  const re = new RegExp(CALL.source, "g");
  re.lastIndex = Math.max(0, start - 1);
  const calls = [];
  let m;
  while ((m = re.exec(code)) !== null) {
    const callStart = m.index + m[1].length;
    if (callStart >= end) break;
    const keyword = m[2];
    const members = m[3] ? m[3].slice(1).split(".") : [];
    let open = m.index + m[0].length - 1; // the "(" that ended the match
    let span = argSpan(code, open);
    if (!span) {
      // An unterminated call cannot end the scan: skip it and keep looking.
      re.lastIndex = open + 1;
      continue;
    }
    // `function it(name, fn) {` and a method `test(value) {` define a function
    // with that name; they are not calls, so neither is a test.
    if (/^\s*\{/.test(code.slice(span.end, span.end + 80))) {
      re.lastIndex = span.end;
      continue;
    }
    // `test.each([...])("name", fn)`, `test.skipIf(cond)("name", fn)`: take the
    // second call as the real one.
    if (members.some((name) => CURRIED.has(name))) {
      EACH_CALL.lastIndex = span.end;
      const next = EACH_CALL.exec(code);
      const inner = next ? argSpan(code, EACH_CALL.lastIndex - 1) : null;
      if (inner) {
        open = EACH_CALL.lastIndex - 1;
        span = inner;
      }
    }
    // Split on the code-only view, where a comma inside a string or regex is
    // blanked; slice the name from the original text at the same offsets.
    const firstLength = (splitTop(code.slice(open + 1, span.end - 1))[0] ?? "").length;
    const first = text.slice(open + 1, open + 1 + firstLength).trim();
    const literal = unquote(first);
    calls.push({
      keyword,
      members,
      focused: keyword === "fit" || keyword === "fdescribe" || members.includes("only"),
      name: literal ?? "(dynamic name)",
      dynamicName: literal === null,
      callStart,
      callEnd: span.end,
      body: DESCRIBES.has(keyword) ? bodyInterior(code, open, span.end) : null,
    });
    re.lastIndex = span.end;
  }
  return calls;
}

/**
 * The interior of a describe's callback. A block callback returns the span
 * inside its braces; an expression-bodied arrow (`() => test(...)`) returns the
 * expression, so the test it holds is still found. The arrow and brace are found
 * on the code-only view, where a `=>` inside the name is blanked; the caller
 * slices the returned span from the original.
 * @param {string} code
 * @param {number} open
 * @param {number} spanEnd
 */
function bodyInterior(code, open, spanEnd) {
  const inner = code.slice(open + 1, spanEnd - 1);
  const callback = inner.search(/=>|\bfunction\b/);
  if (callback === -1) return null;
  // Without a `{` right after the arrow, the first `{` later on belongs to a
  // nested call, not to this callback.
  if (inner.startsWith("=>", callback) && !/^\s*\{/.test(inner.slice(callback + 2))) {
    return { start: open + 1 + callback + 2, end: spanEnd - 1 };
  }
  const brace = inner.indexOf("{", callback);
  if (brace === -1) return null;
  const block = argSpan(code, open + 1 + brace);
  if (!block) return null;
  return { start: open + 1 + brace + 1, end: block.end - 1 };
}

/**
 * The import statements of a file. Lazy through the first module string, so a
 * multi-line brace import stays one statement. `import.meta` and a dynamic
 * `import(...)` are skipped.
 * @param {string} text
 */
function extractImports(text) {
  const re = /^[ \t]*import\b(?!\s*[.(])[\s\S]*?(?:from\s*)?["'][^"']*["'][ \t]*;?/gm;
  return [...text.matchAll(re)].map((m) => m[0].trim());
}

/**
 * A literal test name, or null when the first argument is computed. A template
 * with an interpolation is computed: its text is not the name at run time.
 * @param {string} source
 * @returns {string | null}
 */
function unquote(source) {
  const text = source.trim();
  if (/^"(?:[^"\\]|\\.)*"$/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {
      return text.slice(1, -1);
    }
  }
  if (/^'(?:[^'\\]|\\.)*'$/.test(text)) return text.slice(1, -1).replace(/\\(['\\])/g, "$1");
  if (/^`[^`$]*`$/.test(text)) return text.slice(1, -1);
  return null;
}
