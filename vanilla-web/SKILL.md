---
name: vanilla-web
description: Atle's conventions for building web UIs — vanilla ES modules, HTML <template> components loaded by JS (no HTML strings in JS), reusable component folders with a create-factory contract, @scope CSS, interaction-safe re-renders, zero-dep node server, JSDoc+tsc gate. Use whenever creating or modifying a website, dashboard, or web UI, unless React is explicitly justified.
---

# vanilla-web — how websites get built here

## Decision rule

Default to this stack for every web UI. Reach for React (or another framework)
only with a concrete driver: heavy shared client state across many screens, an
existing React codebase, or a component ecosystem the task genuinely needs
(rich editors, complex drag-drop). "It might grow" is not a driver — this
skeleton grows fine. If React seems warranted, say so and ask before scaffolding.

No build step. No runtime dependencies. Plain ES modules served statically.
The only dev dependency is `typescript` for the typecheck gate.

## App skeleton — always multi-view

Every app starts as views + registry, even with one view (a single page is a
multi-view app with one entry; the skeleton is then already there when page
two arrives).

```
web/
├── index.html           # minimal shell: <header> nav (links href="#/<id>"),
│                        #   <main id="stage">, module script
├── shell.css            # @layer tokens, utilities — see CSS section
├── shell.js             # routing + lifecycle + transitions — copy from this skill dir
├── lib/
│   ├── templates.js     # canonical helpers — copy from this skill dir
│   └── helpers.js       # app-specific shared utils
├── components/          # reusable across views — one folder per component
│   └── stat-card/
│       ├── stat-card.html   # <template id="tpl-stat-card">
│       ├── stat-card.css    # @scope (.stat-card)
│       └── stat-card.js     # export createStatCard() — see Components
└── views/
    ├── registry.js      # export const views = [{ id, title, load: () => import("./overview/index.js") }]
    └── overview/        # one self-contained folder per view
        ├── index.js     # default export: the view contract
        ├── style.css    # @scope'd to the view root
        └── *.html       # view-private <template> files (single-use markup)
```

`index.html` preloads the module graph — `<link rel="modulepreload">` for
`shell.js`, `views/registry.js`, and `lib/templates.js` — since static ESM
otherwise discovers imports one round-trip at a time.

`shell.js` in this skill dir is the canonical shell — copy it verbatim. It
makes `location.hash` (`#/<view-id>`) the source of truth (deep links and the
back button come free), creates one `AbortController` per mount, wraps each
swap in `document.startViewTransition` when available (crossfade for free;
feature-detected), and surfaces swallowed errors — window `error` /
`unhandledrejection` log and fill `<output id="errbar">` when the markup has
one.

The view contract — everything a view starts goes through `helpers.signal`,
so teardown is structural, not a checklist:

```js
let cssLink;
export default {
  id: "overview",
  async mount(container, data, { loadCSS, every, signal }) {
    cssLink = loadCSS(import.meta.url, "./style.css");
    await loadTemplates(new URL("./overview.html", import.meta.url).href);
    // build DOM, then attach EVERYTHING through the signal:
    btn.addEventListener("click", onClick, { signal });   // auto-removed
    const res = await fetch("/api/data", {                 // auto-cancelled + capped
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    });
    every(refresh, 5000, signal);                          // auto-cleared
    const es = new EventSource("/api/events");             // see Live data
    signal.addEventListener("abort", () => es.close(), { once: true });
  },
  unmount() {
    cssLink.remove(); // the shell aborts the signal before calling this
  },
};
```

## HTML — templates in .html files, never strings in JS

All markup lives in `.html` files as `<template id="tpl-…">` blocks with
`data-slot="name"` markers for dynamic content. JS never contains HTML strings
— no `innerHTML = \`…\``, no `createElement` chains for structure (creating a
text node or toggling `hidden` in place is fine).

```html
<template id="tpl-run-row">
  <tr class="run">
    <td class="mono" data-slot="date"></td>
    <td data-slot="task"></td>
  </tr>
</template>
```

```js
const row = tpl("tpl-run-row");
pick(row, "date").textContent = run.date;   // pick() throws on a typo'd slot
host.appendChild(row);
```

Numbers, dates, and durations render through `Intl` (`NumberFormat`,
`DateTimeFormat`, `RelativeTimeFormat`) — never hand-rolled padding or
`toFixed` display logic.

`templates.js` in this skill dir is the canonical helper module
(`loadTemplates`, `tpl`, `slot`, `pick`, `mount`, `loadCSS`, `every`,
`renderRegion`, `selectionInside`). Copy it into `lib/` verbatim; extend,
don't fork.

## Components — reusable UI lives in components/, one folder each

Markup starts view-private (a `<template>` in the view's own `.html`). The
moment a second view needs it, promote it to `components/<name>/` — don't
build a component library speculatively, and don't copy-paste templates
between views.

A component is one folder with three same-named files:

- `<name>.html` — its `<template id="tpl-<name>">` blocks (ids are global,
  so the component name prefixes them);
- `<name>.css` — `@scope (.<name>)` styles, `container-type` on the root if
  its layout should respond to its own width;
- `<name>.js` — a factory that owns loading its own template + CSS (a
  module-level promise makes it once-only), clones, fills slots, wires its
  internal events, and returns the element plus in-place updaters.

```js
// components/stat-card/stat-card.js
// @ts-check
import { loadTemplates, tpl, pick, loadCSS } from "../../lib/templates.js";

let ready;
const ensure = () => (ready ??= Promise.all([
  loadTemplates(new URL("./stat-card.html", import.meta.url).href),
  loadCSS(import.meta.url, "./stat-card.css"),
]));

/** @param {{ label: string, value: string, onSelect?: () => void }} props
 *  @param {AbortSignal} signal — the view's mount signal */
export async function createStatCard({ label, value, onSelect }, signal) {
  await ensure();
  const el = /** @type {HTMLElement} */ (tpl("tpl-stat-card").firstElementChild);
  pick(el, "label").textContent = label;
  const valueEl = pick(el, "value");
  valueEl.textContent = value;
  if (onSelect) el.addEventListener("click", onSelect, { signal });
  return { el, update: (/** @type {string} */ v) => { valueEl.textContent = v; } };
}
```

```js
// in a view's mount():
const card = await createStatCard({ label: "Runs", value: "0" }, signal);
host.append(card.el);
// later ticks mutate in place — no swap, nothing to clobber:
card.update(String(state.runs));
```

The contract in short: **`create<Name>(props, signal) → { el, …updaters }`**.

- Listeners always attach with the caller's `signal`, so component listeners
  die with the view that mounted it — components never need an unmount.
- Component CSS loads once and stays for the app's lifetime (it's `@scope`d,
  it can't leak); only *view* CSS is removed on unmount.
- Data flows in via props and updater calls; events flow out via callback
  props. For anything broader, dispatch a `CustomEvent` on `el` and let the
  view listen — components never import views or reach for global state.
- A component that only renders once can return `el` alone; add updaters the
  first time a caller would otherwise rebuild it.

## CSS — @scope per component, tokens in @layer

- `shell.css` holds design tokens and the few utilities, layered so component
  styles always win without specificity games:

  Tokens use `light-dark()` so one block carries both themes — the OS
  preference picks the side by default, and a manual override is just
  `color-scheme` on the root element: the canonical `shell.js` wires a
  3-state auto/light/dark toggle (persisted in localStorage) to
  `<button id="theme">` whenever the shell markup has one.

  ```css
  @layer tokens, utilities, components;
  @layer tokens {
    :root {
      color-scheme: light dark;
      --bg:       light-dark(#f6f7f9, #0b0d12);
      --text:     light-dark(#1a1d23, #e6e9ef);
      --text-dim: light-dark(#5d6570, #9aa3b2);
      --accent:   light-dark(#1a64d6, #8ab4f8);
      --hairline: light-dark(#d8dce2, #232936);
      --r: 4px;
      --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    }
  }
  @layer utilities {
    .mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
    .dim  { color: var(--text-dim); }
  }
  ```

- Each view/component gets its own `.css` next to its `.html`, wrapped in
  `@scope` on the component's root class — no manual prefixes, no leakage:

  ```css
  @layer components;
  @scope (.scorecard) {
    :scope { container-type: inline-size; padding: 14px 18px; }
    .row { border-bottom: 1px solid var(--hairline); }   /* can't escape .scorecard */
    .chip:hover { border-color: var(--text-dim); }
    @container (width < 600px) {
      .row { grid-template-columns: 1fr; }   /* responds to ITS width */
    }
  }
  ```

- Responsiveness is per-component, not per-viewport: the component root sets
  `container-type: inline-size` and its layout shifts via `@container` — the
  component stays self-contained wherever it's placed. Viewport `@media` only
  for page-level shell layout (collapsing the header nav, etc.).
- View CSS loads via `loadCSS(import.meta.url, "./style.css")` in
  `mount()`, removed in `unmount()`.
- Derive shades instead of hand-picking them:
  `color-mix(in oklch, var(--accent), transparent 85%)` for washes, hovers,
  and surfaces — one accent token, not five near-duplicates.
- Headings get `text-wrap: balance`, prose `text-wrap: pretty` — set once in
  the utilities layer.
- State styling through `:has()` when the DOM already knows:
  `.row:has(:checked)`, `form:has(:user-invalid) .submit` — not a JS class
  toggle.
- Motion is opt-out globally: `shell.css` ends with a
  `prefers-reduced-motion: reduce` block that disables view-transition and
  overlay animations.
- Never: inline `style=` in templates (a CSS var + class instead), shadow DOM,
  BEM prefixes, CSS-in-JS. These are local-first tools for evergreen
  browsers; old browsers are out of scope.

## Re-renders — guarded by default (the no-flicker rule)

Polled UIs clobber open dropdowns, focused inputs, and text selections when
they swap DOM. The rule set, in order of preference:

1. **Mutate in place** for values that change every tick (counters, clocks,
   progress, appended feed lines): update `textContent` / toggle `hidden` on
   existing nodes. No swap → nothing to clobber.
2. **Every region swap goes through `renderRegion(host, build, {sig})`** —
   never raw `replaceChildren`/`innerHTML` on polled data. It skips the swap
   while a control inside `host` is focused, while a popover or `<dialog>`
   inside `host` is open, while a text selection touches `host`, or while
   `sig` is unchanged; a deferred swap lands on the first tick after the
   interaction clears.
3. **Signature hygiene:** `sig` is a cheap string of exactly what the region
   renders. A fast-ticking value must never share a sig with an O(content)
   region — one progress tick must not force a 3000-row table rebuild.
   Separate regions, separate sigs.
4. **Gate at the data layer too:** skip the whole render pass when the
   payload is unchanged (compare a JSON string or ETag). With SSE (see Live
   data) this gate moves to the server: no change → no event → no render
   pass at all — the strongest anti-flicker move is the render that never
   fires.
5. For in-place updaters that write text the user might be selecting, check
   `selectionInside(host)` first and defer — same rule as the focus guard.

Apps with polling + interactive controls should carry an e2e clobber guard:
a test that focuses every control, crosses a poll tick, and fails if a node
was rebuilt under the focus.

## Overlays — native dialog and popover, never hand-rolled

No DIY absolutely-positioned overlay divs with open/close state in JS — the
platform versions are less code and immune to whole classes of bugs:

- **Modals**: `<dialog>` + `dialog.showModal()` — focus trap, ESC-to-close,
  `::backdrop`, top layer, all free.
- **Dropdowns / menus / tooltips**: the `popover` attribute +
  `popovertarget` on the trigger button — zero JS for open/close,
  light-dismiss (click-outside, ESC) built in.

  ```html
  <button popovertarget="run-menu">⋯</button>
  <div id="run-menu" popover class="menu">…</div>
  ```

- **Accordions / disclosure**: `<details>`; a shared `name` attribute makes
  a group exclusive-open. No accordion JS.
- Anchor a dropdown to its trigger with CSS anchor positioning
  (`anchor-name` / `position-area`); wrapper-relative positioning is fine
  for simple cases.
- Open/close animation is pure CSS: `@starting-style` for the entry state,
  `transition-behavior: allow-discrete` so `display` can transition — no JS
  animation hooks.
- `renderRegion` defers swaps while a popover or `<dialog>` inside the host
  is open (same guard as focus/selection), so polled re-renders can't snap
  an open menu shut.

## Forms — native validation, no form layer

- Constraints live in markup: `required`, `pattern`, `min`/`max`,
  `maxlength`, the right `type=`. Submit handlers call
  `form.reportValidity()` and read `new FormData(form)` — always a real
  `<form>`, so Enter-to-submit and validation come free.
- Invalid styling uses `:user-invalid` / `:user-valid` — they fire only
  after the user touches a field, so nothing is red on first paint.
- Input UX is markup too: `inputmode`, `enterkeyhint`, and `autocomplete`
  with real tokens (`email`, `one-time-code`, `current-password`).

## Typing — JSDoc + tsc, always

Every JS module starts with `// @ts-check`; params and exported shapes get
JSDoc annotations; shared shapes live in `types.d.ts`. A tiny `tsconfig.json`
(`allowJs`, `checkJs`, `noEmit`, `strict`, `noUnusedLocals`) and a
`typecheck` npm script gate CI or a hook. `noUnusedLocals` makes stale
imports hard errors instead of runtime surprises; intentionally unused
bindings get a `_` prefix.

## Server

Zero-dependency node `serve.mjs` (skeleton in this skill dir): static files
with MIME map and traversal guard, `PORT`/`HOST` env (default loopback;
`HOST=$(tailscale ip -4)` for tailnet exposure), small same-origin `/api/*`
handlers added in-file when the page needs live data. If the app already has
a Python backend, FastAPI + `StaticFiles` is the accepted alternative — the
frontend conventions don't change.

### Live data — SSE by default, polling as fallback

Live data goes over Server-Sent Events, not interval polling. The skeleton's
SSE section (`/api/events` + `broadcast()`) pushes **only when the payload
changed**, so the client's poll → parse → sig-compare → maybe-render loop
mostly disappears, and `EventSource` reconnects by itself. Client side:

```js
const es = new EventSource("/api/events");
es.onmessage = (e) => {
  const state = JSON.parse(e.data);
  renderRegion(host, () => buildStatus(state), { sig: e.data });
};
signal.addEventListener("abort", () => es.close(), { once: true });
```

Every event means real change, but swaps still go through `renderRegion` —
the user may be mid-interaction when one arrives. Interval polling (via
`every(fn, ms, signal)`) stays acceptable for trivial pages or backends
where an event stream isn't worth the wiring; the re-render rules above are
what make polling survivable.
