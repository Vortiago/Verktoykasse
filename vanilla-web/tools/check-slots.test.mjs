// @ts-check
// gate: off — a test, not a gate half (check.mjs globs tools/check-*.mjs; this
// runs under `node --test` instead).
//
// Guards check-slots' root-slot rule, which exists because pick()/slot() are
// querySelector-based and querySelector NEVER matches the context node. The rule
// has to tell two look-alike shapes apart:
//
//   pick(tpl("x"), "n")                    ✓ fragment — the root IS a child
//   pick(tpl("x").firstElementChild, "n")  ✗ root element — invisible from there
//
// The second is a real bug shipped in Fjellheimen's costs view (two pick() calls
// threw; one slot() rendered nothing at all, silently). The first is a shipped
// idiom in app-bar and side-nav, so a blanket "no markers on roots" rule would
// fail working library code — hence the fixtures below assert BOTH directions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));

/** Run check-slots over a throwaway tree. The checker resolves its file set from
 * its own location (tools/ sits in the root it checks), so the fixture needs a
 * real tools/ dir with copies — a symlink would resolve back to the source tree.
 * @param {string} html @param {string} js */
function run(html, js) {
  const dir = mkdtempSync(join(tmpdir(), "check-slots-"));
  mkdirSync(join(dir, "tools"));
  for (const f of ["check-slots.mjs", "js-scan.mjs"]) copyFileSync(join(HERE, f), join(dir, "tools", f));
  writeFileSync(join(dir, "c.html"), html);
  writeFileSync(join(dir, "c.js"), js);
  const r = spawnSync(process.execPath, [join(dir, "tools", "check-slots.mjs")], { cwd: dir, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

test("root-slot read through .firstElementChild is an error (pick — throws at runtime)", () => {
  const { code, out } = run(
    `<template id="tpl-a"><div data-slot="kpis"></div></template>`,
    `const el = tpl("tpl-a").firstElementChild;\nconst h = pick(el, "kpis");\n`,
  );
  assert.equal(code, 1);
  assert.match(out, /ROOT of <template id="tpl-a">/);
  assert.match(out, /pick\(\) throws at runtime/);
});

test("root-slot written through .firstElementChild is an error (slot — silent)", () => {
  const { code, out } = run(
    `<template id="tpl-n"><p data-slot="msg"></p></template>`,
    `const el = tpl("tpl-n").firstElementChild;\nslot(el, { msg });\n`,
  );
  assert.equal(code, 1);
  assert.match(out, /slot\(\) silently renders nothing/, "the silent failure must be called out as such");
});

test("the fragment idiom is NOT flagged — app-bar and side-nav ship it", () => {
  const { code, out } = run(
    `<template id="tpl-i"><a data-slot="link"></a></template>`,
    `const node = tpl("tpl-i");\nconst a = pick(node, "link");\n`,
  );
  assert.equal(code, 0, out);
});

test("descendant markers read through the root element are fine", () => {
  const { code, out } = run(
    `<template id="tpl-r"><li><span data-slot="label"></span></li></template>`,
    `const el = tpl("tpl-r").firstElementChild;\nslot(el, { label });\n`,
  );
  assert.equal(code, 0, out);
});

test("a name on the root AND a descendant stays reachable, so it is not flagged", () => {
  const { code, out } = run(
    `<template id="tpl-b"><div data-slot="dup"><span data-slot="dup"></span></div></template>`,
    `const el = tpl("tpl-b").firstElementChild;\nslot(el, { dup });\n`,
  );
  assert.equal(code, 0, out);
});

test("variable linking is windowed: each helper's own `el` binds to its own template", () => {
  // Both helpers name the receiver `el`. A file-wide link would test "rows"
  // against tpl-one and "kpis" against tpl-two, mixing the two up.
  const { code, out } = run(
    `<template id="tpl-one"><div data-slot="kpis"></div></template>`
    + `<template id="tpl-two"><ul data-slot="rows"></ul></template>`,
    `function a() {\n  const el = tpl("tpl-one").firstElementChild;\n  return pick(el, "kpis");\n}\n`
    + `function b() {\n  const el = tpl("tpl-two").firstElementChild;\n  return pick(el, "rows");\n}\n`,
  );
  assert.equal(code, 1);
  assert.match(out, /tpl-one/);
  assert.match(out, /tpl-two/);
  assert.equal((out.match(/ROOT of/g) || []).length, 2, "one error per helper, not cross-linked");
});

test("a type-cast wrapper between the declaration and tpl() does not hide the pattern", () => {
  // The conventions wrap these in a JSDoc cast; comments are stripped to spaces,
  // so the regex must tolerate the leftover parenthesis and whitespace.
  const { code } = run(
    `<template id="tpl-c"><div data-slot="x"></div></template>`,
    `const el = /** @type {HTMLElement} */ (tpl("tpl-c").firstElementChild);\nconst h = pick(el, "x");\n`,
  );
  assert.equal(code, 1);
});

test(".firstChild and .children[0] are the same mistake", () => {
  for (const accessor of [".firstChild", ".children[0]"]) {
    const { code, out } = run(
      `<template id="tpl-d"><div data-slot="y"></div></template>`,
      `const el = tpl("tpl-d")${accessor};\nconst h = pick(el, "y");\n`,
    );
    assert.equal(code, 1, `${accessor} should be caught: ${out}`);
  }
});

test("the pre-existing checks still hold: unknown template id and unknown slot name", () => {
  const missingTpl = run(`<template id="tpl-e"><div data-slot="a"></div></template>`, `tpl("tpl-nope");\n`);
  assert.equal(missingTpl.code, 1);
  assert.match(missingTpl.out, /no <template id="tpl-nope">/);

  const missingName = run(`<template id="tpl-e"><div><span data-slot="a"></span></div></template>`, `const n = tpl("tpl-e");\npick(n, "typo");\n`);
  assert.equal(missingName.code, 1);
  assert.match(missingName.out, /no data-slot="typo"/);
});
