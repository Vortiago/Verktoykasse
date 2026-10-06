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
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));

/** Run check-css-tokens over a throwaway tree. Same shape as check-slots.test:
 * the checker resolves its file set from its own location, so the fixture needs
 * a real tools/ dir with copies rather than a symlink.
 * @param {import("node:test").TestContext} t @param {Record<string, string>} files path → contents */
function run(t, files) {
  const dir = mkdtempSync(join(tmpdir(), "check-css-tokens-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, "tools"));
  for (const f of ["check-css-tokens.mjs", "js-scan.mjs"]) copyFileSync(join(HERE, f), join(dir, "tools", f));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
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

test("a raw colour in a declaration is an error, and the message names the token to use", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { background: #ff0000; } }`,
  });
  assert.equal(code, 1);
  assert.match(out, /raw-color/);
  assert.match(out, /--bg/, "advice must name the property family's tokens, not just refuse");
});

test("a raw colour that a token already holds is reported as that token", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { color: #1a64d6; } }`,
  });
  assert.equal(code, 1);
  assert.match(out, /already --accent/, "an exact re-spell of a token must be named, not merely rejected");
});

test("advice never names a token from a file the flagged CSS cannot resolve", (t) => {
  // preview.css declares its palette under `@layer preview` and no component
  // loads it. Advising var(--page-bg) there would name a property that resolves
  // nowhere, and check-css-vars — also tree-global — would pass it.
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "preview.css": `@layer preview { :root { --page-bg: #ff00ff; } }`,
    "components/c/c.css": `@scope (.c) { :scope { background: #ff00ff; } }`,
  });
  assert.equal(code, 1);
  assert.doesNotMatch(out, /--page-bg/, "a token outside @layer tokens must not be offered as advice");
});

test("the definition site is legal — that is the whole point of the rule", (t) => {
  const { code } = run(t, { "tokens.css": TOKENS, "components/c/c.css": `@scope (.c) { :scope { color: var(--text); } }` });
  assert.equal(code, 0);
});

test("color-mix shade derivation is NOT drift (black/white endpoints, `in oklch`)", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) {
      :scope:hover { background: color-mix(in srgb, var(--accent) 88%, black); }
      .wash { background: color-mix(in oklch, var(--accent), transparent 85%); }
    }`,
  });
  assert.equal(code, 0, out);
});

test("a hex inside a color-mix is still drift — a literal wearing a mix for a hat", (t) => {
  const { code } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { background: color-mix(in srgb, var(--accent) 88%, #000); } }`,
  });
  assert.equal(code, 1);
});

test("a selector is not a declaration (a:hover must not read as `a: hover`)", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { a:hover { color: var(--accent); } }`,
  });
  assert.equal(code, 0, out);
});

test("a colour word inside a quoted font family is not a colour", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { font-family: "Gold Sans", sans-serif; } }`,
  });
  assert.equal(code, 0, out);
});

test("inline style= in a template is an error", (t) => {
  const { code, out } = run(t, { "tokens.css": TOKENS, "c.html": `<template id="tpl-a"><div style="color: red"></div></template>` });
  assert.equal(code, 1);
  assert.match(out, /inline-style/);
  assert.match(out, /custom property/, "the message must say what to do instead");
});

test("a component stylesheet with no @scope is an error", (t) => {
  const { code, out } = run(t, { "tokens.css": TOKENS, "components/c/c.css": `.c { color: var(--text); }` });
  assert.equal(code, 1);
  assert.match(out, /unscoped-css/);
});

test("a dimension @media in a component is an error; a feature query is not", (t) => {
  const bad = run(t, { "tokens.css": TOKENS, "components/c/c.css": `@scope (.c) { @media (width < 600px) { :scope { color: var(--text); } } }` });
  assert.equal(bad.code, 1);
  assert.match(bad.out, /viewport-media/);
  assert.match(bad.out, /@container/, "the message must point at the replacement");

  const ok = run(t, { "tokens.css": TOKENS, "components/c/c.css": `@scope (.c) { @media (prefers-reduced-motion: reduce) { :scope { animation: none; } } }` });
  assert.equal(ok.code, 0, ok.out);
});

test("a gate-allow comment suppresses, per line and per file", (t) => {
  const line = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { background: #ff0000; /* gate-allow: raw-color */ } }`,
  });
  assert.equal(line.code, 0, line.out);

  const file = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `/* gate-allow: raw-color */\n@scope (.c) { :scope { background: #ff0000; color: #00ff00; } }`,
  });
  assert.equal(file.code, 0, file.out);
});

test("a named colour beyond the common few is still a colour", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { background: whitesmoke; border-color: darkred; } }`,
  });
  assert.equal(code, 1);
  assert.match(out, /whitesmoke/);
  assert.match(out, /darkred/, "the list is the whole spec list, not the obvious names");
});

test("a bare keyword is only a colour where a colour is accepted", (t) => {
  // Unlike #abc or rgb(, a keyword is not self-identifying: these are a font
  // stack and a trig function, and both carry a colour name.
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) {
      :scope { font-family: Gold Sans, sans-serif; width: calc(100px * tan(30deg)); }
      .b { animation-name: coral; }
    }`,
  });
  assert.equal(code, 0, out);
});

test("a color-mix carrying no token is a palette choice, not a derivation", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) {
      :scope { background: color-mix(in srgb, black 50%, white); }
      .ok { background: color-mix(in srgb, var(--accent) 88%, black); }
    }`,
  });
  assert.equal(code, 1);
  assert.match(out, /black/);
  assert.doesNotMatch(out, /\.ok/, "mixing into a token stays exempt");
  assert.equal(out.match(/raw-color/g)?.length, 2, "both endpoints of the tokenless mix");
});

test("an HTML template escapes in HTML comment syntax", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "c.html": `<template id="tpl-a"><div style="color: red"></div><!-- gate-allow: inline-style --></template>`,
  });
  assert.equal(code, 0, out);
});

test("a raw colour inside a comment is not a finding (offsets survive stripping)", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) {\n  /* was background: #ff0000 before tokens */\n  :scope { background: var(--bg); }\n}`,
  });
  assert.equal(code, 0, out);
});

test("a quoted value cannot steer the brace walk (a `;`/`{` in content is text)", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope::after { content: "a; b { color: #fff }"; color: var(--text); } }`,
  });
  assert.equal(code, 0, out);
});

test("an unquoted url() is a path, not a value", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) {
      :scope { background: var(--bg) url(img/tan.png) no-repeat; }
      .b { fill: url(#bead); }
    }`,
  });
  assert.equal(code, 0, out);
});

test("a keyword followed by `(` is a function call — tan() in a shadow's length", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { box-shadow: 0 0 calc(10px * tan(30deg)) var(--hairline); } }`,
  });
  assert.equal(code, 0, out);
});

test("a vendor-prefixed property is a property", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { -webkit-text-fill-color: #ff0000; } }`,
  });
  assert.equal(code, 1);
  assert.match(out, /-webkit-text-fill-color/);
});

test("a property name is case-insensitive; a custom property name is not", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `@scope (.c) { :scope { BACKGROUND-COLOR: gold; } }`,
  });
  assert.equal(code, 1, out);
  assert.match(out, /--bg/, "the advice table is spelled lower, so the property has to be too");
});

test("a header gate-allow may carry its reason on the lines below it", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `/* gate-allow: raw-color\n * the vendor's brand red, fixed by contract.\n */\n@scope (.c) { :scope { background: #ff0000; } }`,
  });
  assert.equal(code, 0, out);
});

test("advice names the token this tree calls text, whatever it is called", (t) => {
  // new-app.mjs scaffolds --fg/--line, vanilla-components ships --text/--hairline.
  // Offering --accent for `color:` because --text is absent is worse than no advice.
  const { code, out } = run(t, {
    "shell.css": `@layer tokens { :root {
      --bg: light-dark(#fafafa, #131315);
      --fg: light-dark(#1a1a1a, #e8e8e8);
      --accent: light-dark(#0b57d0, #8ab4f8);
    } }`,
    "views/v/v.css": `@scope (.v) { :scope { color: #333333; } }`,
  });
  assert.equal(code, 1);
  assert.match(out, /use one of --fg/);
});

test("a CRLF checkout spells the escape the same way", (t) => {
  const { code, out } = run(t, {
    "tokens.css": TOKENS,
    "components/c/c.css": `/* gate-allow: raw-color\r\n * the vendor's brand red.\r\n */\r\n@scope (.c) { :scope { background: #ff0000; } }\r\n`,
  });
  assert.equal(code, 0, out);
});
