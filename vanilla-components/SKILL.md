---
name: vanilla-components
description: Shared vanilla-web component library + unified design tokens — copy-verbatim, no build, no deps. Atoms (panel, stat-card, chip, status-dot, tooltip) + shell components (app-bar, side-nav, view-header) on the create-factory + @scope contract, plus a light-dark() token set. Use when building a vanilla-web UI and reaching for a panel/stat/chip/dot/tooltip/nav/header or a common token set, instead of hand-rolling one.
---

# vanilla-components — shared parts for vanilla-web UIs

A concrete component library built ON the `vanilla-web` conventions (which are
the engine: ES modules, `<template>`s, `@scope`, the create-factory contract).
`vanilla-web` is the "how"; this is the "what". No build, no runtime deps.

Distribution is **copy-verbatim** (the vanilla-web way): an app copies the parts
it needs into its own tree. No package, no symlink — the app stays self-contained
and statically servable. Re-copy to update; never fork in place.

## Consume

- **Tokens** — copy `tokens.css` into the app and `@import`/`<link>` it before
  component CSS. It's a superset that's drop-in for GitLandscape + Slipestein
  token names. A dark-only app sets `color-scheme: dark` at its root and every
  `light-dark()` resolves dark (zero visual change).
- **A component** — copy `components/<name>/` into the app's `components/`
  (a sibling of `lib/`, per the vanilla-web layout — the component imports
  `../../lib/templates.js`, so that relative shape must hold). Or run
  `./vendor.sh <name> <app>/components`, which copies + stamps a provenance
  header. Needs `lib/templates.js` present (the vanilla-web canonical module),
  and the app's tsconfig `include` must cover `components/**/*.js`.
- Each component self-loads its own `<name>.html` + `<name>.css` on first use;
  just `import { create<Name> }` and call it.

## Tokens (names in `tokens.css`)

`--bg --bg-elev --bg-elev-2 --line/--hairline` · `--text --text-dim` ·
`--accent --ok --warn --bad --info` · `--sans --mono` ·
`--space-xs|s|m|l` · `--r --r-pill`. All colors are `light-dark()`.

## Components (contract: `create<Name>(props[, signal]) → { el, …updaters }`)

| Component | Factory | Key props |
|---|---|---|
| panel | `createPanel({ head?, body?, fill? }) → { el, headEl, bodyEl }` | head/body take string or Node; `fill` stretches + scrolls body |
| stat-card | `createStatCard({ label, value, unit?, hint?, tone?, onSelect? }, signal?) → { el, update(value, hint?) }` | tone: ok\|warn\|bad\|accent; `update()` mutates in place for polled values |
| chip | `createChip({ text, tone?, dot? }) → { el, setText(text) }` | tone: ok\|warn\|bad\|info\|accent; `dot` = leading dot |
| status-dot | `createStatusDot({ tone?, pulse?, label? }) → { el, setTone(t), setPulse(on) }` | tone: neutral\|ok\|warn\|bad\|info\|accent; `pulse` halo (respects reduced-motion) |
| tooltip | `createTooltip(host, { className? }, signal?) → { node, show(content, x, y, box?), hide(), dispose() }` | top-layer manual popover, edge-clamped; aborts/disposes with `signal`. Also exports `clampTip(...)`. |
| app-bar | `createAppBar({ brand, items, current?, onSelect? }, signal?) → { el, actionsEl, setCurrent }` | top bar: brand · pill nav (`<a href="#/<id>">`) · `actionsEl` slot; `setCurrent(id)` marks active; optional per-item `accent` |
| side-nav | `createSideNav({ groups, current?, onSelect? }, signal?) → { el, setCurrent }` | grouped left-pane nav; `journey` group variant = numbered pipeline + done-checks; item `chip` composes the chip atom |
| view-header | `createViewHeader({ eyebrow?, title, sub?, actions? }) → { el, actionsEl, setTitle, setSub }` | stage header: eyebrow · title · sub · `actionsEl` slot |

Tones derive from one `--tone` custom property via `color-mix` — restyle by
overriding the token, not the rule.

**Shell components** (`app-bar`, `side-nav`, `view-header`) are registry-driven and
follow the vanilla-web hash convention: they render `<a href="#/<id>">` and expose
`setCurrent(id)` — the app keeps owning its `hashchange` loop. They also pick ONE
house look, so adopting them converges an app's existing nav styling (a deliberate
visual change, not a pure drop-in).

## Run the catalogue

`node serve.mjs` → `http://127.0.0.1:8080/preview.html` (regenerates the preview
registry on startup; theme toggle exercises light/dark). The typecheck gate is
`tsc --noEmit -p tsconfig.json` — every module is `// @ts-check` + JSDoc.

## Add a component

1. `components/<name>/<name>.{html,css,js}` following the factory contract above.
2. `node previews/new.mjs <name>` seeds `<name>.preview.js`; fill in `variants`.
3. `node serve.mjs` regenerates `previews/registry.js` and serves it.

Out of current scope (candidates for later): richer factories (legend, scrubber),
chart/sparkline primitives, and TapScribe's idiom migration (it's BEM + different
token names today). `bridge/` holds the claude.ai/design bridge: `emit-adapter.mjs`
generates a React-shim adapter package the design-sync converter consumes (the
library is synced to the "Vanilla Components" project; see `.design-sync/NOTES.md`).
