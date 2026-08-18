#!/usr/bin/env node
// canonical source: vanilla-web/tools/check-slots.mjs@b78a4af — vendored copy, do not edit here
// @ts-check
// check-slots — static gate for the .html ↔ .js template seam, the one boundary
// `tsc` cannot see. Template ids and data-slot names are stringly-typed:
// a typo'd tpl("tpl-buttn") throws only at runtime, and a typo'd slot key
// silently renders nothing (slot() is querySelectorAll-based). This walks
// **/*.html for <template id="tpl-…"> ids + data-slot names, and **/*.js for
// the string literals in tpl("…"), pick(el, "…"), slot(frag, {…}) keys, and
// [data-slot="…"] selectors (regex-grade — the conventions keep these calls
// syntactically uniform).
//
//   error    tpl() id with no <template id> in any .html
//   error    pick()/slot()/selector name with no data-slot marker anywhere
//   error    a data-slot on a template's ROOT read through that root element
//            (the unreachable-root-slot rule — see below)
//   warning  template or data-slot never referenced from JS (dead markup —
//            non-fatal: tests may reach slots via querySelector/getByTestId)
//
// Scope is the whole app namespace, not per-template: a pick() takes a runtime
// fragment, so the checker can't know which template it targets — pooling all
// ids/names still catches the typo class, which is the point. JS-created
// markers (dataset.slot = "x", setAttribute("data-slot", …)) count as defined.
//
// THE ROOT-SLOT RULE. pick()/slot() are querySelector(All)-based, and those never
// match the context node itself — only descendants. So a data-slot on a
// template's own root element behaves in two opposite ways:
//
//   const node = tpl("tpl-x");                    // DocumentFragment
//   pick(node, "link")                            // ✓ root IS a child of the fragment
//
//   const el = tpl("tpl-x").firstElementChild;    // the root ELEMENT
//   pick(el, "link")                              // ✗ throws: slot not found
//   slot(el, { link: v })                         // ✗ WORSE: silent, renders nothing
//
// The fragment form is a legitimate shipped idiom (app-bar and side-nav both use
// it), so this cannot be an HTML-only "no root slots" rule — it would fail
// working library code. The checker therefore keys on `.firstElementChild` (or
// .firstChild / .children[0]) and only errors when a name read through that root
// element is a root marker and not also on a descendant. Variable linking is
// windowed to the next redeclaration of the same name, because helper functions
// in one file routinely each declare their own `el`.
// node_modules/ and testing/ (deliberately-weird fixtures) are skipped.
// Zero-dep; same shape + exit contract as check-css-vars. Exit 1 on any error.
import { globSync, readFileSync } from "node:fs";
import { ROOT, SKIP, lineOf, stripComments, argSpan } from "./js-scan.mjs";

const html = globSync("**/*.html", { cwd: ROOT }).filter((p) => !SKIP.test(p + "/"));
const js = globSync("**/*.js", { cwd: ROOT }).filter((p) => !SKIP.test(p + "/"));

/** Top-level (depth-0) split of an argument list on commas. @param {string} args */
function splitTop(args) {
  /** @type {string[]} */ const parts = [];
  let depth = 0, start = 0;
  /** @type {string[]} */ const ctx = [];
  for (let i = 0; i < args.length; i++) {
    const c = args[i], top = ctx[ctx.length - 1];
    if (top === '"' || top === "'" || top === "`") {
      if (c === "\\") i++;
      else if (c === top) ctx.pop();
    } else if (c === '"' || c === "'" || c === "`") ctx.push(c);
    else if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    else if (c === "," && depth === 0) { parts.push(args.slice(start, i)); start = i + 1; }
  }
  parts.push(args.slice(start));
  return parts;
}

// ── Collect definitions from .html ──────────────────────────────────────────
/** @type {Map<string, {file: string, line: number}>} */ const templates = new Map();
/** @type {Map<string, {file: string, line: number}>} */ const slotDefs = new Map();
/** Per template, which slot markers sit on its ROOT element vs on a descendant —
 * the distinction the root-slot rule turns on.
 * @type {Map<string, {root: Set<string>, deep: Set<string>, file: string, line: number}>} */
const tplShape = new Map();

for (const rel of html) {
  const text = stripComments(readFileSync(new URL(rel, ROOT), "utf8"), true);
  for (const m of text.matchAll(/<template\b[^>]*\bid=["'](tpl-[\w-]+)["']/g)) {
    if (!templates.has(m[1])) templates.set(m[1], { file: rel, line: lineOf(text, m.index) });
  }
  for (const m of text.matchAll(/\bdata-slot=["']([\w-]+)["']/g)) {
    if (!slotDefs.has(m[1])) slotDefs.set(m[1], { file: rel, line: lineOf(text, m.index) });
  }
  // Split each template's markers into root-element vs descendant.
  for (const m of text.matchAll(/<template\b[^>]*\bid=["'](tpl-[\w-]+)["'][^>]*>([\s\S]*?)<\/template>/g)) {
    const id = m[1], body = m[2];
    if (tplShape.has(id)) continue;
    /** @type {Set<string>} */ const root = new Set();
    /** @type {Set<string>} */ const deep = new Set();
    const first = body.match(/<([a-zA-Z][\w-]*)\b([^>]*?)\/?>/);
    if (first) {
      for (const a of (first[2] || "").matchAll(/\bdata-slot=["']([\w-]+)["']/g)) root.add(a[1]);
      for (const a of body.slice((first.index ?? 0) + first[0].length).matchAll(/\bdata-slot=["']([\w-]+)["']/g)) deep.add(a[1]);
    }
    tplShape.set(id, { root, deep, file: rel, line: lineOf(text, m.index) });
  }
}

// ── Collect references from .js ──────────────────────────────────────────────
/** @type {Array<{id: string, file: string, line: number}>} */ const tplRefs = [];
/** @type {Array<{name: string, file: string, line: number}>} */ const nameRefs = [];

/** Root-slot rule violations. @type {string[]} */ const rootErrors = [];

for (const rel of js) {
  const text = stripComments(readFileSync(new URL(rel, ROOT), "utf8"), false);
  /** This file's reads, with the receiver and offset the root-slot rule needs.
   * @type {Array<{name: string, arg: string, idx: number, via: "pick" | "slot"}>} */
  const localRefs = [];
  for (const m of text.matchAll(/\btpl\(\s*["'`]([\w-]+)["'`]/g)) {
    tplRefs.push({ id: m[1], file: rel, line: lineOf(text, m.index) });
  }
  // pick(el, "name") — balanced scan of the args, name = a plain-literal 2nd arg.
  for (const m of text.matchAll(/\bpick\s*\(/g)) {
    const span = argSpan(text, m.index + m[0].length - 1);
    if (span == null) continue;
    const parts = splitTop(span.args);
    const second = parts[1]?.trim() ?? "";
    const lit = second.match(/^["'`]([\w-]+)["'`]$/);
    if (lit) localRefs.push({ name: lit[1], arg: (parts[0] ?? "").trim(), idx: m.index, via: "pick" });
  }
  // slot(frag, { key: v, shorthand, "quoted": v }) — top-level keys of the 2nd arg.
  for (const m of text.matchAll(/\bslot\s*\(/g)) {
    const span = argSpan(text, m.index + m[0].length - 1);
    if (span == null) continue;
    const parts = splitTop(span.args);
    const second = parts[1]?.trim() ?? "";
    if (!second.startsWith("{")) continue;
    for (const entry of splitTop(second.slice(1, second.lastIndexOf("}")))) {
      const key = entry.trim().match(/^(?:["']([\w-]+)["']|([A-Za-z_$][\w$]*))\s*(?::|$)/);
      const name = key?.[1] ?? key?.[2];
      if (name && !entry.trim().startsWith("...")) {
        localRefs.push({ name, arg: (parts[0] ?? "").trim(), idx: m.index, via: "slot" });
      }
    }
  }
  for (const r of localRefs) nameRefs.push({ name: r.name, file: rel, line: lineOf(text, r.idx) });

  // `tpl("ID").firstElementChild` hands back the ROOT ELEMENT — from there a
  // marker ON that root is invisible. Link the declared variable to its reads,
  // stopping at the next redeclaration of the same name (helpers each declare
  // their own `el`, so a file-wide link would cross-contaminate).
  for (const d of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*?\btpl\(\s*["'`]([\w-]+)["'`]\s*\)\s*\.\s*(?:firstElementChild|firstChild|children\s*\[\s*0\s*\])/g)) {
    const varName = d[1], id = d[2];
    const shape = tplShape.get(id);
    if (!shape || shape.root.size === 0) continue;
    const from = (d.index ?? 0) + d[0].length;
    const rd = text.slice(from).search(new RegExp(`\\b(?:const|let|var)\\s+${varName}\\b`));
    const limit = rd === -1 ? text.length : from + rd;
    for (const r of localRefs) {
      if (r.idx < from || r.idx >= limit || r.arg !== varName) continue;
      if (!shape.root.has(r.name) || shape.deep.has(r.name)) continue;
      rootErrors.push(
        `${rel}:${lineOf(text, r.idx)}  ${r.via}(${varName}, "${r.name}") reads a marker that sits on the ROOT of `
        + `<template id="${id}"> (${shape.file}:${shape.line}). ${varName} IS that root element, and `
        + `querySelector never matches the context node — ${r.via === "slot" ? "slot() silently renders nothing" : "pick() throws at runtime"}. `
        + `Move data-slot="${r.name}" onto a child, or drop it and address ${varName} directly.`,
      );
    }
  }
  // Selector references — querySelector('[data-slot="x"]') and friends.
  for (const m of text.matchAll(/\[data-slot=\\?["']?([\w-]+)/g)) {
    nameRefs.push({ name: m[1], file: rel, line: lineOf(text, m.index) });
  }
  // JS-created markers define, not reference: el.dataset.slot = "x" / setAttribute.
  for (const m of text.matchAll(/\.dataset\.slot\s*=\s*["'`]([\w-]+)["'`]/g)) {
    if (!slotDefs.has(m[1])) slotDefs.set(m[1], { file: rel, line: lineOf(text, m.index) });
  }
  for (const m of text.matchAll(/setAttribute\(\s*["'`]data-slot["'`]\s*,\s*["'`]([\w-]+)["'`]/g)) {
    if (!slotDefs.has(m[1])) slotDefs.set(m[1], { file: rel, line: lineOf(text, m.index) });
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const errors = [
  ...tplRefs.filter((r) => !templates.has(r.id))
    .map((r) => `${r.file}:${r.line}  tpl("${r.id}") — no <template id="${r.id}"> in any .html`),
  ...nameRefs.filter((r) => !slotDefs.has(r.name))
    .map((r) => `${r.file}:${r.line}  slot "${r.name}" — no data-slot="${r.name}" marker in any template`),
  ...rootErrors,
];
const usedTpl = new Set(tplRefs.map((r) => r.id));
const usedName = new Set(nameRefs.map((r) => r.name));
const warnings = [
  ...[...templates].filter(([id]) => !usedTpl.has(id))
    .map(([id, d]) => `${d.file}:${d.line}  <template id="${id}"> never referenced from JS`),
  ...[...slotDefs].filter(([name]) => !usedName.has(name))
    .map(([name, d]) => `${d.file}:${d.line}  data-slot="${name}" never referenced from JS`),
];

for (const w of warnings) console.warn(`  warning: ${w}`);
if (errors.length) {
  console.error(`✖ ${errors.length} template-seam error${errors.length === 1 ? "" : "s"} (typo, or .html and .js out of sync):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`✓ check-slots: ${tplRefs.length + nameRefs.length} template/slot references resolve (${templates.size} templates, ${slotDefs.size} slot names across ${html.length} .html + ${js.length} .js files${warnings.length ? `; ${warnings.length} warning(s)` : ""})`);
