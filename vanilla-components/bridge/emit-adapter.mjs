#!/usr/bin/env node
// @ts-check
// Build the React-shim ADAPTER PACKAGE that design-sync's converter consumes.
//
// design-sync is React-only: it esbuild-bundles a package's dist entry into
// window.<global>. So we present the vanilla library AS a React package: each
// dist module is the real vanilla factory (verbatim — only its dev-server
// self-loaders neutralized: template inlined + registered lazily, loadCSS no-op,
// component CSS shipped via styles.css instead) wrapped in a thin React shim.
//
// Output: bridge/ds-adapter/  (package.json, dist/*.js + *.d.ts, styles.css, css/)
//   node bridge/emit-adapter.mjs

import { readFile, writeFile, mkdir, copyFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE); // vanilla-components/
const ADAPTER = join(HERE, "ds-adapter");

/** Each component: Pascal name, the d.ts Props body (agent-facing, narrowed),
 *  and whether it's the imperative tooltip (custom shim). */
const COMPONENTS = [
  { name: "panel", Pascal: "Panel", props: `head?: string;\n  body?: string;\n  fill?: boolean;` },
  { name: "stat-card", Pascal: "StatCard", props: `label: string;\n  value: string | number;\n  unit?: string;\n  hint?: string;\n  tone?: "ok" | "warn" | "bad" | "accent";` },
  { name: "chip", Pascal: "Chip", props: `text: string;\n  tone?: "ok" | "warn" | "bad" | "info" | "accent";\n  dot?: boolean;` },
  { name: "status-dot", Pascal: "StatusDot", props: `tone?: "neutral" | "ok" | "warn" | "bad" | "info" | "accent";\n  pulse?: boolean;\n  label?: string;` },
  { name: "tooltip", Pascal: "Tooltip", props: `content?: string;`, tooltip: true },
  { name: "app-bar", Pascal: "AppBar", props: `brand: { logo?: string; title: string; tagline?: string };\n  items: { id: string; label: string; accent?: string }[];\n  current?: string;` },
  { name: "side-nav", Pascal: "SideNav", props: `groups: { label?: string; variant?: "list" | "journey"; items: { id: string; label: string; icon?: string; chip?: { text: string; tone?: "ok" | "warn" | "bad" | "info" | "accent" }; done?: boolean }[] }[];\n  current?: string;` },
  { name: "view-header", Pascal: "ViewHeader", props: `eyebrow?: string;\n  title: string;\n  sub?: string;` },
];

/** Transform a real factory module into a self-contained dist module:
 *  strip the templates.js import, neutralize loadTemplates/loadCSS, inline+register
 *  the <template>, keep the factory verbatim. */
function neutralize(name, factorySrc, html) {
  let js = factorySrc
    .replace(/^import\s*\{[^}]*\}\s*from\s*["']\.\.\/\.\.\/lib\/templates\.js["'];?\s*$/m, "")
    // ensure() self-load -> lazy template registration; CSS ships via styles.css
    .replace(new RegExp(`loadTemplates\\(new URL\\(["']\\./${name}\\.html["'],\\s*import\\.meta\\.url\\)\\.href\\)`), "ensureTemplate()")
    .replace(new RegExp(`loadCSS\\(import\\.meta\\.url,\\s*["']\\./${name}\\.css["']\\)`), "null")
    // inter-component imports (e.g. side-nav -> chip): the adapter dist is flat,
    // so "../chip/chip.js" becomes "./chip.js".
    .replace(/from\s*["']\.\.\/([a-z-]+)\/\1\.js["']/g, 'from "./$1.js"');
  // Guard: if a factory's ensure() shape ever drifts, the replaces above miss and
  // we'd emit a module referencing the now-stripped loaders — fail loud at build
  // time instead of silently at render.
  if (/loadTemplates\(|loadCSS\(/.test(js)) {
    throw new Error(`neutralize(${name}): a loadTemplates(/loadCSS( call survived — the factory's ensure() shape changed; update the transform in emit-adapter.mjs`);
  }
  // Same fail-loud principle for inter-component imports: only ../<x>/<x>.js
  // siblings are flattened above, so any surviving "../" import would 404 at
  // render in the flat adapter dist — catch it at build time instead.
  if (/from\s*["']\.\.\//.test(js)) {
    throw new Error(`neutralize(${name}): an unflattened "../" import survived — either a sibling import the rewrite doesn't model (only ../<name>/<name>.js is flattened) or a multi-line ../../lib/templates.js import the single-line strip missed; update emit-adapter.mjs`);
  }
  return `// Adapter module for "${name}" — the real vanilla factory, dev-server
// self-loading neutralized (template inlined below, CSS shipped via styles.css).
import React from "react";
import { tpl, pick, slot } from "./_bridge-templates.js";

const __HTML = ${JSON.stringify(html)};
let __reg = false;
const ensureTemplate = () => {
  if (__reg) return;
  __reg = true;
  const d = document.createElement("div");
  d.hidden = true;
  d.innerHTML = __HTML;
  document.body.append(...d.children);
};

${js.trim()}
`;
}

const declarativeShim = (Pascal, create) => `
export function ${Pascal}(props) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    let alive = true;
    Promise.resolve(${create}(props || {})).then((c) => {
      if (alive && ref.current) ref.current.replaceChildren(c.el || c.node || c);
    });
    return () => { alive = false; };
  }, [JSON.stringify(props)]);
  // A plain block wrapper (not display:contents) so the card has a measurable box.
  return React.createElement("div", { ref });
}
`;

const tooltipShim = (Pascal, create) => `
// Imperative overlay -> demo shim: mount a host and show the tip immediately so
// the design-sync card isn't blank (the live component is hover-driven).
export function ${Pascal}({ content = "Tooltip" } = {}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const ac = new AbortController();
    let tip;
    Promise.resolve(${create}(host, {}, ac.signal)).then((t) => { tip = t; t.show(content, 16, 8); });
    return () => { ac.abort(); tip && tip.dispose && tip.dispose(); };
  }, [content]);
  return React.createElement("div", { ref, style: { position: "relative", minHeight: "72px", minWidth: "220px" } });
}
`;

// ---- _bridge-templates.js: tpl/pick/slot real; loaders unused (kept for API parity) ----
const bridgeTemplates = `// Bridge edition of templates.js: real tpl/pick/slot; no loaders (templates are
// pre-registered per-module, CSS ships via styles.css).
export const tpl = (id) => {
  const t = document.getElementById(id);
  if (!t) throw new Error("template not loaded: " + id);
  return t.content.cloneNode(true);
};
export const pick = (frag, n) => {
  const el = frag.querySelector('[data-slot="' + n + '"]');
  if (!el) throw new Error('slot not found: ' + n);
  return el;
};
export const slot = (frag, slots) => {
  for (const [k, v] of Object.entries(slots)) {
    if (v == null) continue;
    for (const el of frag.querySelectorAll('[data-slot="' + k + '"]')) el.textContent = String(v);
  }
  return frag;
};
`;

// Wipe only the generated parts — preserve node_modules (installed deps).
await rm(join(ADAPTER, "dist"), { recursive: true, force: true });
await rm(join(ADAPTER, "css"), { recursive: true, force: true });
await mkdir(join(ADAPTER, "dist"), { recursive: true });
await mkdir(join(ADAPTER, "css"), { recursive: true });

await writeFile(join(ADAPTER, "dist", "_bridge-templates.js"), bridgeTemplates);

const exportsList = [];
const dtsParts = [];
// cssEntry must be a COMPILED stylesheet (real rules), not @import stubs — the
// converter copies it verbatim into the styles.css closure. So inline tokens +
// every component's @scope block into one file.
const cssChunks = [`/* tokens */\n` + (await readFile(join(ROOT, "tokens.css"), "utf8")).trim()];

for (const c of COMPONENTS) {
  const compDir = join(ROOT, "components", c.name);
  const factory = await readFile(join(compDir, `${c.name}.js`), "utf8");
  const html = await readFile(join(compDir, `${c.name}.html`), "utf8");
  const css = await readFile(join(compDir, `${c.name}.css`), "utf8");
  const create = `create${c.Pascal}`;
  const shim = c.tooltip ? tooltipShim(c.Pascal, create) : declarativeShim(c.Pascal, create);
  await writeFile(join(ADAPTER, "dist", `${c.name}.js`), neutralize(c.name, factory, html) + shim);
  await copyFile(join(compDir, `${c.name}.css`), join(ADAPTER, "css", `${c.name}.css`));
  exportsList.push(`export { ${c.Pascal} } from "./${c.name}.js";`);
  dtsParts.push(`export interface ${c.Pascal}Props {\n  ${c.props}\n}\nexport declare function ${c.Pascal}(props: ${c.Pascal}Props): JSX.Element;`);
  cssChunks.push(`/* ${c.name} */\n` + css.trim());
}

await writeFile(join(ADAPTER, "dist", "index.js"), exportsList.join("\n") + "\n");
await writeFile(join(ADAPTER, "dist", "index.d.ts"), dtsParts.join("\n\n") + "\n");
await copyFile(join(ROOT, "tokens.css"), join(ADAPTER, "tokens.css"));
await writeFile(join(ADAPTER, "styles.css"), cssChunks.join("\n\n") + "\n");
await writeFile(join(ADAPTER, "package.json"), JSON.stringify({
  name: "vanilla-components",
  version: "0.0.0",
  private: true,
  type: "module",
  module: "dist/index.js",
  main: "dist/index.js",
  types: "dist/index.d.ts",
  peerDependencies: { react: ">=18" },
}, null, 2) + "\n");

console.log(`adapter: ${COMPONENTS.length} components -> bridge/ds-adapter/`);
console.log(`  exports: ${COMPONENTS.map((c) => c.Pascal).join(", ")}`);
