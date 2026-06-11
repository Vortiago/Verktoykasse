---
name: vanilla-web
description: Atle's conventions for building web UIs — vanilla ES modules, HTML <template> components loaded by JS (no HTML strings in JS), @scope CSS, interaction-safe re-renders, zero-dep node server, JSDoc+tsc gate. Use whenever creating or modifying a website, dashboard, or web UI, unless React is explicitly justified.
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
└── views/
    ├── registry.js      # export const views = [{ id, title, load: () => import("./overview/index.js") }]
    └── overview/        # one self-contained folder per view
        ├── index.js     # default export: the view contract
        ├── style.css    # @scope'd to the view root
        └── *.html       # <template> component files for this view
```

`shell.js` in this skill dir is the canonical shell — copy it verbatim. It
makes `location.hash` (`#/<view-id>`) the source of truth (deep links and the
back button come free), creates one `AbortController` per mount, and wraps
each swap in `document.startViewTransition` when available (crossfade for
free; feature-detected — Firefox only shipped it late 2025).

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
    const res = await fetch("/api/data", { signal });      // auto-cancelled
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

`templates.js` in this skill dir is the canonical helper module
(`loadTemplates`, `tpl`, `slot`, `pick`, `mount`, `loadCSS`, `every`,
`renderRegion`, `selectionInside`). Copy it into `lib/` verbatim; extend,
don't fork.

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
- Never: inline `style=` in templates (a CSS var + class instead), shadow DOM,
  BEM prefixes, CSS-in-JS. `@scope` and nesting are evergreen-baseline since
  2024; these are local-first tools, old browsers are out of scope.

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
   region (one job-progress tick forcing a 3000-row rebuild was a real
   TapScribe lockup). Separate regions, separate sigs.
4. **Gate at the data layer too:** skip the whole render pass when the
   payload is unchanged (compare a JSON string or ETag). With SSE (see Live
   data) this gate moves to the server: no change → no event → no render
   pass at all — the strongest anti-flicker move is the render that never
   fires.
5. For in-place updaters that write text the user might be selecting, check
   `selectionInside(host)` first and defer — same rule as the focus guard.

Apps with polling + interactive controls should carry the e2e clobber guard:
a test that focuses every control, crosses a poll tick, and fails if a node
was rebuilt under the focus (reference:
`test_next_poll_render_does_not_clobber_open_controls`, TapScribe).

## Overlays — native dialog and popover, never hand-rolled

No DIY absolutely-positioned overlay divs with open/close state in JS — the
platform versions are less code and immune to whole classes of bugs:

- **Modals**: `<dialog>` + `dialog.showModal()` — focus trap, ESC-to-close,
  `::backdrop`, top layer, all free.
- **Dropdowns / menus / tooltips**: the `popover` attribute +
  `popovertarget` on the trigger button — zero JS for open/close,
  light-dismiss (click-outside, ESC) built in. Baseline since 2024.

  ```html
  <button popovertarget="run-menu">⋯</button>
  <div id="run-menu" popover class="menu">…</div>
  ```

- Caveat: CSS anchor positioning is still Chrome-only — position simple
  dropdowns with plain CSS relative to a wrapper for now.
- `renderRegion` defers swaps while a popover or `<dialog>` inside the host
  is open (same guard as focus/selection), so polled re-renders can't snap
  an open menu shut.

## Typing — JSDoc + tsc, always

Every JS module starts with `// @ts-check`; params and exported shapes get
JSDoc annotations; shared shapes live in `types.d.ts`. A tiny `tsconfig.json`
(`allowJs`, `checkJs`, `noEmit`, `strict`, `noUnusedLocals`) and a
`typecheck` npm script gate CI or a hook. `noUnusedLocals` makes stale
imports hard errors — the removed-import-still-used bug is invisible at
runtime because listener exceptions get swallowed. Intentionally unused
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

## Reference implementations

- `~/repos/Slipestein/main/dash/` — smallest example: templates + slots,
  per-section CSS, aggregating API proxy. (Predates @scope + view registry.)
- `~/repos/GitLandscape/main/web/` — view registry, mount/unmount + loadCSS,
  canvas-heavy views. (Predates the template pattern — builds DOM in JS.)
- `~/repos/TapScribe/main/tapscribe/web/` — origin of `renderRegion`,
  interaction-hold lore, e2e clobber guards, JSDoc+tsc gate. (Global CSS,
  guards opt-in rather than default.)

All three predate parts of this skill (none yet use SSE, the signal
lifecycle, native overlays, hash routing, or container queries); when
touching them, converge toward the skill, not the other way. This file is
the canonical statement.
