#!/usr/bin/env node
// @ts-check
// new-app — one-command scaffold for the canonical vanilla-web app skeleton
// (see SKILL.md). Replaces the copy-this-then-that ritual with one command:
//
//   node <vanilla-web>/new-app.mjs <target-dir> [app-name]
//
// Copies the canonical set verbatim (shell.js, templates.js → lib/templates.js,
// render.js → lib/render.js, chrome.js → lib/chrome.js,
// api-client.js → lib/api-client.js, serve.mjs, tsconfig.json, tools/*.mjs),
// stamping each copy `canonical source: vanilla-web/<path>@<rev>` so
// tools/check-vendored.mjs can report drift later — and writes the per-app,
// shape-fixed boilerplate: index.html (nav, #stage, errbar, theme button,
// modulepreload set), shell.css skeleton, views/registry.js with one contract-
// correct `overview` view. One-time only: refuses to overwrite ANY existing
// file (all targets are checked up front). No flags, no prompts, zero-dep.
import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { basename, dirname, extname, join, resolve } from "node:path";

const SRC = dirname(fileURLToPath(import.meta.url)); // the vanilla-web skill dir

const targetArg = process.argv[2];
if (!targetArg) {
  console.error("usage: node <vanilla-web>/new-app.mjs <target-dir> [app-name]");
  process.exit(2);
}
const target = resolve(targetArg);
const appName = process.argv[3] || basename(target);

const rev = (() => {
  try { return execFileSync("git", ["-C", SRC, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return "unknown"; }
})();

// ── The canonical set — copied verbatim + stamped ────────────────────────────
/** @type {Array<[string, string]>} [source path under vanilla-web, dest path] */
const canon = [
  ["shell.js", "shell.js"],
  ["templates.js", "lib/templates.js"], // the real module, not the skill-local lib/ shim
  ["render.js", "lib/render.js"], // interaction-safe re-rendering — same real-vs-shim note
  ["chrome.js", "lib/chrome.js"], // page-chrome wiring — same real-vs-shim note
  ["api-client.js", "lib/api-client.js"],
  ["serve.mjs", "serve.mjs"],
  ["tsconfig.json", "tsconfig.json"], // .json can't carry a comment stamp — copied bare
  ...globSync("tools/*.mjs", { cwd: SRC }).sort().map((p) => /** @type {[string, string]} */([p, p])),
];

/** Port of lib-stamp.sh's stamp_file: prepend a one-line provenance comment in
 * the file's own comment syntax, below a shebang when one leads (a shebang must
 * stay on line 1 or `node <file>` throws). Unknown syntax → no stamp.
 * @param {string} content @param {string} destName @param {string} srcPath */
function stamped(content, destName, srcPath) {
  const text = `canonical source: vanilla-web/${srcPath}@${rev} — re-copy to update, don't fork`;
  const line = { ".js": `// ${text}`, ".mjs": `// ${text}`, ".css": `/* ${text} */`, ".html": `<!-- ${text} -->` }[extname(destName)];
  if (!line) return content;
  if (content.startsWith("#!")) {
    const nl = content.indexOf("\n");
    return `${content.slice(0, nl + 1)}${line}\n${content.slice(nl + 1)}`;
  }
  return `${line}\n${content}`;
}

// ── Per-app boilerplate — string literals, contract-correct per SKILL.md ─────
const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${appName}</title>
  <link rel="stylesheet" href="./shell.css" />
  <link rel="modulepreload" href="./shell.js" />
  <link rel="modulepreload" href="./lib/templates.js" />
  <link rel="modulepreload" href="./lib/render.js" />
  <link rel="modulepreload" href="./lib/chrome.js" />
  <link rel="modulepreload" href="./views/registry.js" />
</head>
<body>
  <header>
    <nav>
      <a href="#/overview">Overview</a>
    </nav>
    <button id="theme" type="button">auto</button>
  </header>
  <output id="errbar" hidden></output>
  <main id="stage"></main>
  <script type="module" src="./shell.js"></script>
</body>
</html>
`;

const shellCss = `/* ${appName} — shell chrome + tokens. Views/components bring their own @scope'd CSS. */
@layer tokens, base;

@layer tokens {
  :root {
    color-scheme: light dark; /* light-dark() tokens follow this; #theme overrides it */
    --bg: light-dark(#fafafa, #131315);
    --fg: light-dark(#1a1a1a, #e8e8e8);
    --accent: light-dark(#0b57d0, #8ab4f8);
    --line: light-dark(#e2e2e2, #333);
  }
}

@layer base {
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--fg); }
  header { display: flex; align-items: center; gap: 1rem; padding: 0.5rem 1rem; border-bottom: 1px solid var(--line); }
  nav { display: flex; gap: 0.75rem; }
  nav a { color: inherit; text-decoration: none; }
  nav a[aria-current] { color: var(--accent); font-weight: 600; }
  #theme { margin-inline-start: auto; }
  #errbar { display: block; padding: 0.5rem 1rem; background: light-dark(#fdecea, #4a1512); color: light-dark(#b3261e, #ffb4ab); }
  #errbar[hidden] { display: none; }
  #stage { padding: 1rem; }
  [aria-busy="true"] { opacity: 0.6; } /* withPending's busy look */
}

/* Reduced motion: neutralise view-transition animation here (withTransition
   deliberately never checks it in JS). */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }
}
`;

const registryJs = `// @ts-check
// The app's routable views, in nav order. shell.js reads this list; adding a
// view = a folder under views/ + one entry here (+ a nav link in index.html).

/** A view module's default export. @typedef {{
 *   id: string,
 *   mount(container: HTMLElement, data: unknown, helpers: { loadCSS: Function, every: Function, signal: AbortSignal }): void | Promise<void>,
 *   unmount(): void,
 * }} View */

/** @typedef {{ id: string, title?: string, load: () => Promise<{ default: View }> }} ViewEntry */

/** @type {ViewEntry[]} */
export const views = [
  { id: "overview", title: "Overview", load: () => import("./overview/index.js") },
];
`;

const overviewHtml = `<template id="tpl-overview">
  <section class="overview">
    <h1 data-slot="title"></h1>
    <p data-slot="tagline"></p>
  </section>
</template>
`;

const overviewJs = `// @ts-check
// Overview — the scaffold's example view; replace its body, keep its shape.
// The whole view contract in one screen: markup lives in overview.html as a
// <template> with data-slot markers (never HTML strings in JS), per-view CSS
// loads through loadCSS with the mount signal (auto-removed on unmount), and
// every resource a view opens ties to helpers.signal — so unmount stays empty.
import { loadTemplates, tpl, slot, mount } from "../../lib/templates.js";

export default {
  id: "overview",
  /** @param {HTMLElement} container @param {unknown} _data
   * @param {{ loadCSS: Function, every: Function, signal: AbortSignal }} helpers */
  async mount(container, _data, { loadCSS, signal }) {
    loadCSS(import.meta.url, "./style.css", signal);
    await loadTemplates(new URL("./overview.html", import.meta.url).href);
    mount(container, slot(tpl("tpl-overview"), {
      title: document.title,
      tagline: "Scaffolded by vanilla-web/new-app.mjs — replace this view.",
    }));
  },
  unmount() {}, // signal-scoped resources self-release
};
`;

const overviewCss = `/* Overview view — @scope'd to the view root so nothing leaks across views. */
@scope (.overview) {
  :scope { display: grid; gap: 0.5rem; max-width: 60ch; }
  h1 { margin: 0; font-size: 1.5rem; }
  p { margin: 0; color: color-mix(in oklab, var(--fg) 70%, transparent); }
}
`;

/** @type {Array<[string, string]>} [dest path, content] */
const boilerplate = [
  ["index.html", indexHtml],
  ["shell.css", shellCss],
  ["views/registry.js", registryJs],
  ["views/overview/overview.html", overviewHtml],
  ["views/overview/index.js", overviewJs],
  ["views/overview/style.css", overviewCss],
];

// ── One-time only: check EVERY target before writing anything ────────────────
const conflicts = [...canon.map(([, d]) => d), ...boilerplate.map(([d]) => d)]
  .filter((d) => existsSync(join(target, d)));
if (conflicts.length) {
  console.error(`✖ refusing to overwrite ${conflicts.length} existing file(s) in ${target}:`);
  for (const c of conflicts) console.error(`  ${c}`);
  console.error("new-app.mjs scaffolds once — update vendored files by re-copying from the skill (see tools/check-vendored.mjs).");
  process.exit(1);
}

for (const [src, dest] of canon) {
  mkdirSync(join(target, dirname(dest)), { recursive: true });
  writeFileSync(join(target, dest), stamped(readFileSync(join(SRC, src), "utf8"), dest, src));
}
for (const [dest, content] of boilerplate) {
  mkdirSync(join(target, dirname(dest)), { recursive: true });
  writeFileSync(join(target, dest), content);
}

console.log(`✓ scaffolded ${appName} at ${target} (canon vanilla-web@${rev}: ${canon.length} copied files + ${boilerplate.length} app files)

next:
  cd ${targetArg}
  node serve.mjs          # → http://127.0.0.1:8080/
  node tools/check.mjs    # the gate (--fast skips node --test)`);
