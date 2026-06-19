#!/usr/bin/env node
// @ts-check
// Build the React-shim ADAPTER PACKAGE that design-sync's converter consumes.
//
// design-sync is React-only: it esbuild-bundles a package's dist entry into
// window.<global>. So we present the vanilla library AS a React package: each
// dist module is the real vanilla factory (verbatim — its two lib/ imports
// swapped for bridge editions: tpl/pick/slot, and a defineComponent whose warm
// injects the pre-inlined <template>; loadCSS no-op, CSS ships via styles.css)
// wrapped in a thin React shim.
//
// The component list is DISCOVERED by walking components/ (no central table):
// each component carries a <name>.bridge.mjs with its narrowed Props + optional
// shim; a real component dir missing its sidecar fails the build loudly.
//
// Output: bridge/ds-adapter/  (package.json, dist/*.js + *.d.ts, styles.css, css/)
//   node bridge/emit-adapter.mjs

import { readFile, writeFile, mkdir, copyFile, rm, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE); // vanilla-components/
const ADAPTER = join(HERE, "ds-adapter");

const SHIMS = new Set(["declarative", "tooltip", "dialog"]);
const toPascal = (name) => name.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");

/** Discover the components by walking components/ — a real component is a <name>/
 *  dir holding <name>.js. Each MUST carry a <name>.bridge.mjs declaring its
 *  design-sync contract ({ props, shim? }), or opt out with { skip: true }; a real
 *  dir with no sidecar throws here rather than silently missing from the adapter.
 *  Pascal is derived from the dir name. Returns sorted { name, Pascal, props, shim }. */
async function discoverComponents() {
  const dir = join(ROOT, "components");
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!e.isDirectory()) continue;
    const name = e.name;
    const isComponent = await stat(join(dir, name, `${name}.js`)).then(() => true).catch(() => false);
    if (!isComponent) continue; // not a component dir
    const sidecar = join(dir, name, `${name}.bridge.mjs`);
    let meta;
    try {
      meta = (await import(pathToFileURL(sidecar).href)).default;
    } catch (err) {
      // Only "file absent" is the missing-sidecar case; a sidecar that exists but
      // fails to load (syntax/runtime error) must surface its real error, not be
      // mislabelled as missing.
      if (err && /** @type {{ code?: string }} */ (err).code === "ERR_MODULE_NOT_FOUND") {
        throw new Error(`emit-adapter: components/${name}/ has no ${name}.bridge.mjs — add one ({ props, shim? }) so the component reaches design-sync, or set { skip: true } to opt out.`);
      }
      throw err;
    }
    if (meta?.skip) continue;
    if (typeof meta?.props !== "string") {
      throw new Error(`emit-adapter: ${name}.bridge.mjs must export default { props: string, shim?: "declarative" | "tooltip" | "dialog" }.`);
    }
    const shim = meta.shim ?? "declarative";
    if (!SHIMS.has(shim)) {
      throw new Error(`emit-adapter: ${name}.bridge.mjs has unknown shim ${JSON.stringify(shim)} — use "declarative", "tooltip", or "dialog".`);
    }
    out.push({ name, Pascal: toPascal(name), props: meta.props, shim });
  }
  return out;
}

const COMPONENTS = await discoverComponents();

/** Transform a real factory module into a self-contained dist module: swap the two
 *  lib imports for bridge editions (tpl/pick/slot + defineComponent), register the
 *  inlined <template> (no fetch; CSS ships via styles.css), keep the factory verbatim.
 *  The loaders now live inside defineComponent, so there are no per-factory
 *  loadTemplates/loadCSS calls to strip — only the two imports are swapped. */
function neutralize(name, factorySrc, html) {
  let js = factorySrc
    .replace(/^import\s*\{[^}]*\}\s*from\s*["']\.\.\/\.\.\/lib\/templates\.js["'];?\s*$/m, "")
    .replace(/^import\s*\{[^}]*\}\s*from\s*["']\.\.\/\.\.\/lib\/component\.js["'];?\s*$/m, "")
    // inter-component imports (e.g. side-nav -> chip): the adapter dist is flat,
    // so "../chip/chip.js" becomes "./chip.js".
    .replace(/from\s*["']\.\.\/([a-z-]+)\/\1\.js["']/g, 'from "./$1.js"');
  // Guard: both lib imports must be gone — a survivor would pull the real fetch/DOM
  // loaders into the design-sync runtime. Fail loud at build time, not at render.
  if (/from\s*["']\.\.\/\.\.\/lib\/(templates|component)\.js["']/.test(js)) {
    throw new Error(`neutralize(${name}): a ../../lib import survived — the import shape changed (e.g. multi-line); update the strip in emit-adapter.mjs`);
  }
  // Same fail-loud principle for inter-component imports: only ../<x>/<x>.js
  // siblings are flattened above, so any surviving "../" import would 404 at
  // render in the flat adapter dist — catch it at build time instead.
  if (/from\s*["']\.\.\//.test(js)) {
    throw new Error(`neutralize(${name}): an unflattened "../" import survived — a sibling import the rewrite doesn't model (only ../<name>/<name>.js is flattened); update emit-adapter.mjs`);
  }
  return `// Adapter module for "${name}" — the real vanilla factory; the lib imports are
// swapped for bridge editions and the <template> is pre-inlined + registered
// (no fetch; CSS ships via styles.css). The factory body is verbatim.
import React from "react";
import { tpl, pick, slot } from "./_bridge-templates.js";
import { defineComponent, __registerTemplate } from "./_bridge-defineComponent.js";

__registerTemplate(${JSON.stringify(name)}, ${JSON.stringify(html)});

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
// Hover-driven tooltip -> demo shim: render a trigger, tether the tip to it and
// show it immediately so the design-sync card isn't blank.
export function ${Pascal}({ content = "Tooltip" } = {}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "hover me";
    Object.assign(trigger.style, { font: "inherit", fontSize: "12px", padding: "4px 10px", border: "1px solid var(--hairline)", borderRadius: "var(--r)", background: "var(--bg-elev)", color: "var(--text)", cursor: "help" });
    host.replaceChildren(trigger);
    const ac = new AbortController();
    let tip;
    Promise.resolve(${create}(trigger, { content }, ac.signal)).then((t) => { tip = t; t.show(); });
    return () => { ac.abort(); tip && tip.dispose && tip.dispose(); };
  }, [content]);
  return React.createElement("div", { ref, style: { padding: "44px 16px 16px", minHeight: "120px", display: "flex", justifyContent: "center", alignItems: "flex-start" } });
}
`;

const dialogShim = (Pascal, create) => `
// A <dialog> is hidden until opened; the card shows it open-inline (non-modal) so
// it isn't blank. The real component is driven by open()/close() (see prompt.md).
export function ${Pascal}(props) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let alive = true;
    Promise.resolve(${create}(props || {})).then((c) => {
      if (!alive || !host) return;
      c.el.open = true;
      // a real dialog overlays (out of flow → 0-height card); for the preview,
      // pin it into normal flow so the card shows the box.
      Object.assign(c.el.style, { position: "static", margin: "0", inset: "auto" });
      host.replaceChildren(c.el);
    });
    return () => { alive = false; };
  }, [JSON.stringify(props)]);
  return React.createElement("div", { ref });
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

// ---- _bridge-defineComponent.js: warm injects a pre-inlined <template> (no
//      fetch); CSS ships via styles.css. Same { warm, sync, create } contract. ----
const bridgeDefineComponent = `// Bridge edition of lib/component.js: warm injects a pre-registered <template>
// (each dist module calls __registerTemplate at import) instead of fetching; CSS
// ships via styles.css. Same { warm, sync, create } contract as the real one.
const __templates = new Map();
export const __registerTemplate = (name, html) => { __templates.set(name, html); };

export function defineComponent(_moduleUrl, name, build, composes = []) {
  let reg = false;
  const warm = () => {
    if (!reg) {
      reg = true;
      const html = __templates.get(name);
      if (html) {
        const d = document.createElement("div");
        d.hidden = true;
        d.innerHTML = html;
        document.body.append(...d.children);
      }
    }
    return Promise.all(composes.map((w) => w())); // warm composed children (e.g. chip) too
  };
  return {
    warm,
    sync: build,
    create: async (...args) => { await warm(); return build(...args); },
  };
}
`;

// Wipe only the generated parts — preserve node_modules (installed deps).
await rm(join(ADAPTER, "dist"), { recursive: true, force: true });
await rm(join(ADAPTER, "css"), { recursive: true, force: true });
await mkdir(join(ADAPTER, "dist"), { recursive: true });
await mkdir(join(ADAPTER, "css"), { recursive: true });

await writeFile(join(ADAPTER, "dist", "_bridge-templates.js"), bridgeTemplates);
await writeFile(join(ADAPTER, "dist", "_bridge-defineComponent.js"), bridgeDefineComponent);

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
  const shim = c.shim === "tooltip" ? tooltipShim(c.Pascal, create)
    : c.shim === "dialog" ? dialogShim(c.Pascal, create)
    : declarativeShim(c.Pascal, create);
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
