// @ts-check
// Unit guards for tools/js-scan.mjs — the scanning helpers every check-*.mjs
// gate half leans on. The load-bearing case is template-literal interpolation:
// `${` enters code context WITHOUT opening a bracket, so its closing `}` must
// pop context only, never the bracket depth (a depth decrement there truncated
// argSpan mid-template — the addEventListener case below is the real-world
// shape that bug hid). commentMatch guards the suppression markers: a
// `// gate-allow:` inside a string literal must not count as a comment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { stripComments, argSpan, splitTop, commentMatch, lineOf } from "./js-scan.mjs";

/** argSpan().args of `src` from its first `(`. @param {string} src */
const args = (src) => argSpan(src, src.indexOf("("))?.args ?? null;

test("argSpan: plain call", () => {
  assert.equal(args("foo(a, b)"), "a, b");
});

test("argSpan: nested brackets stay inside one span", () => {
  assert.equal(args("foo(bar(1, [2, 3]), { a: { b: 1 } })"), "bar(1, [2, 3]), { a: { b: 1 } }");
});

test("argSpan: brackets inside strings don't count", () => {
  assert.equal(args(`foo("a)b", 'c}d')`), `"a)b", 'c}d'`);
});

test("argSpan: template literal WITH interpolation spans the whole call", () => {
  assert.equal(args("foo(bar, `x${a+b}y`, baz)"), "bar, `x${a+b}y`, baz");
});

test("argSpan: nested braces inside an interpolation balance", () => {
  assert.equal(args("foo(`v=${ {a: 1}.a }`, tail)"), "`v=${ {a: 1}.a }`, tail");
});

test("argSpan: addEventListener with ${} in the callback followed by { signal }", () => {
  const src = "el.addEventListener(\"click\", () => { log(`n=${n + 1}`); }, { signal })";
  assert.equal(args(src), "\"click\", () => { log(`n=${n + 1}`); }, { signal }");
});

test("argSpan: unterminated call returns null; end indexes past the paren", () => {
  assert.equal(argSpan("foo(a, b", 3), null);
  const span = argSpan("foo(a) rest", 3);
  assert.deepEqual(span, { args: "a", end: 6 });
});

test("splitTop: top-level commas only — nested calls, objects, strings, templates stay whole", () => {
  assert.deepEqual(splitTop("a, b"), ["a", " b"]);
  assert.deepEqual(splitTop("fn(a, b), [1, 2], { x: 1, y: 2 }"), ["fn(a, b)", " [1, 2]", " { x: 1, y: 2 }"]);
  assert.deepEqual(splitTop(`"a,b", 'c,d'`), [`"a,b"`, ` 'c,d'`]);
  assert.deepEqual(splitTop("`${f(a, b)},x`, tail"), ["`${f(a, b)},x`", " tail"]);
  assert.deepEqual(splitTop(""), []);
});

test("splitTop: the two-vs-three-arg distinction check-conventions needs", () => {
  // A callback body mentioning `signal` must stay inside argument #2.
  const twoArg = splitTop(`"click", () => { const signal = ac.signal; use(signal); }`);
  assert.equal(twoArg.length, 2, "a two-arg call has NO options argument");
  const threeArg = splitTop(`"click", () => go(), { signal }`);
  assert.equal(threeArg.length, 3);
  assert.match(threeArg[2], /\bsignal\b/);
});

test("stripComments: blanks line + block comments, preserves offsets and newlines", () => {
  const src = "a // tail\nb /* mid */ c";
  const out = stripComments(src);
  assert.equal(out.length, src.length);
  assert.equal(out, "a        \nb           c");
  assert.equal(lineOf(out, out.indexOf("c")), 2, "offsets preserved → lineOf stays valid");
});

test("stripComments: comment markers inside strings and templates are left alone", () => {
  const src = "const a = \"// not a comment\"; const b = `/* nor ${x} this */`; // real";
  const out = stripComments(src);
  assert.ok(out.includes("\"// not a comment\""), "string content survives");
  assert.ok(out.includes("`/* nor ${x} this */`"), "template content survives");
  assert.ok(!out.includes("// real"), "the trailing real comment is blanked");
});

test("stripComments: a // inside an interpolated URL string is not a comment", () => {
  const src = "const u = `${base}//path`; // tail";
  const out = stripComments(src);
  assert.ok(out.includes("`${base}//path`"));
  assert.ok(!out.includes("// tail"));
});

// ── commentMatch — the suppression-marker guard (check-conventions.mjs) ──────

const GATE_ALLOW = /\/\/\s*gate-allow:\s*([\w-,\s]+)/g;

/** @param {string} line */
const markerIn = (line) => commentMatch(line, stripComments(line), GATE_ALLOW);

test("commentMatch: a real trailing gate-allow comment matches", () => {
  const m = markerIn('el.innerHTML = x; // gate-allow: html-string');
  assert.ok(m);
  assert.equal(m[1].trim(), "html-string");
});

test("commentMatch: a gate-allow inside a string literal does NOT match", () => {
  assert.equal(markerIn('const s = "// gate-allow: html-string";'), null);
  assert.equal(markerIn("const s = `// gate-allow: signal-listener`;"), null);
});

test("commentMatch: static-render in a string does not suppress; in a comment it does", () => {
  const SR = /\/\/\s*static-render\b/g;
  const inString = 'render("// static-render")';
  assert.equal(commentMatch(inString, stripComments(inString), SR), null);
  const inComment = "host.replaceChildren(frag); // static-render";
  assert.ok(commentMatch(inComment, stripComments(inComment), SR));
});
