// @ts-check
// gate: off — a test, not a gate half (check.mjs globs tools/check-*.mjs; this
// runs under `node --test` instead).
//
// Guards check-css-tokens' rules. The raw-color rule is the one that has to tell
// look-alike shapes apart, because the stack's OWN idioms are colour-adjacent:
//
//   --accent: #1a64d6                              ✓ the definition site
//   color-mix(in srgb, var(--accent) 88%, black)   ✓ deriving a shade (button.css)
//   color-mix(in oklch, var(--accent), transparent 85%)  ✓ `in oklch` is a space
//   background: #1a64d6                            ✗ the drift this exists to catch
//
// A rule that fired on the first three would fail shipped library code on day
// one and get switched off, so every one of them is asserted clean below.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));

/** Run check-css-tokens over a throwaway tree. Same shape as check-slots.test:
 * the checker resolves its file set from its own location, so the fixture needs
 * a real tools/ dir with copies rather than a symlink.
 * @param {Record<string, string>} files path → contents, relative to the root */
function run(files) {
  const dir = mkdtempSync(join(tmpdir(), "check-css-tokens-"));
  mkdirSync(join(dir, "tools"));
  for (const f of ["check-css-tokens.mjs", "js-scan.mjs"]) copyFileSync(join(HERE, f), join(dir, "tools", f));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  const r = spawnSync(process.execPath, [join(dir, "tools", "check-css-tokens.mjs")], { cwd: dir, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

/** A minimal token file, so advice has a real vocabulary to name. */
const TOKENS = `@layer tokens { :root {
  --bg: light-dark(#f3f4f7, #0b0d12);
  --text: light-dark(#1a1d23, #e6e9ef);
  --accent: light-dark(#1a64d6, #8ab4f8);
  --hairline: light-dark(#d9dce3, #262d3a);
} }`;

test("a raw colour in a declaration is an error, and the message names the token to use", () => {
  const { code, out } = run({
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { background: #ff0000; } }`,
  });
  assert.equal(code, 1);
  assert.match(out, /raw-color/);
  assert.match(out, /--bg/, "advice must name the property family's tokens, not just refuse");
});

test("a raw colour that a token already holds is reported as that token", () => {
  const { code, out } = run({
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { color: #1a64d6; } }`,
  });
  assert.equal(code, 1);
  assert.match(out, /already --accent/, "an exact re-spell of a token must be named, not merely rejected");
});

test("the definition site is legal — that is the whole point of the rule", () => {
  const { code } = run({ "tokens.css": TOKENS, "components/c/c.css": `@scope (.c) { :scope { color: var(--text); } }` });
  assert.equal(code, 0);
});

test("color-mix shade derivation is NOT drift (black/white endpoints, `in oklch`)", () => {
  const { code, out } = run({
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) {
      :scope:hover { background: color-mix(in srgb, var(--accent) 88%, black); }
      .wash { background: color-mix(in oklch, var(--accent), transparent 85%); }
    }`,
  });
  assert.equal(code, 0, out);
});

test("a hex inside a color-mix is still drift — a literal wearing a mix for a hat", () => {
  const { code } = run({
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { background: color-mix(in srgb, var(--accent) 88%, #000); } }`,
  });
  assert.equal(code, 1);
});

test("a selector is not a declaration (a:hover must not read as `a: hover`)", () => {
  const { code, out } = run({
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { a:hover { color: var(--accent); } }`,
  });
  assert.equal(code, 0, out);
});

test("a colour word inside a quoted font family is not a colour", () => {
  const { code, out } = run({
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { font-family: "Gold Sans", sans-serif; } }`,
  });
  assert.equal(code, 0, out);
});

test("inline style= in a template is an error", () => {
  const { code, out } = run({ "tokens.css": TOKENS, "c.html": `<template id="tpl-a"><div style="color: red"></div></template>` });
  assert.equal(code, 1);
  assert.match(out, /inline-style/);
  assert.match(out, /custom property/, "the message must say what to do instead");
});

test("a component stylesheet with no @scope is an error", () => {
  const { code, out } = run({ "tokens.css": TOKENS, "components/c/c.css": `.c { color: var(--text); }` });
  assert.equal(code, 1);
  assert.match(out, /unscoped-css/);
});

test("a dimension @media in a component is an error; a feature query is not", () => {
  const bad = run({ "tokens.css": TOKENS, "components/c/c.css": `@scope (.c) { @media (width < 600px) { :scope { color: var(--text); } } }` });
  assert.equal(bad.code, 1);
  assert.match(bad.out, /viewport-media/);
  assert.match(bad.out, /@container/, "the message must point at the replacement");

  const ok = run({ "tokens.css": TOKENS, "components/c/c.css": `@scope (.c) { @media (prefers-reduced-motion: reduce) { :scope { animation: none; } } }` });
  assert.equal(ok.code, 0, ok.out);
});

test("a gate-allow comment suppresses, per line and per file", () => {
  const line = run({
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { background: #ff0000; /* gate-allow: raw-color */ } }`,
  });
  assert.equal(line.code, 0, line.out);

  const file = run({
    "tokens.css": TOKENS,
    "components/c/c.css": `/* gate-allow: raw-color */\n@scope (.c) { :scope { background: #ff0000; color: #00ff00; } }`,
  });
  assert.equal(file.code, 0, file.out);
});

test("a raw colour inside a comment is not a finding (offsets survive stripping)", () => {
  const { code, out } = run({
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) {\n  /* was background: #ff0000 before tokens */\n  :scope { background: var(--bg); }\n}`,
  });
  assert.equal(code, 0, out);
});
