---
name: vanilla-components
description: Shared vanilla-web component library + unified design tokens: copy-verbatim, no build, no deps. Atoms (panel, stat-card, chip, status-dot, avatar, tooltip), shell (app-bar, side-nav, view-header), controls (button, field, code-input, progress, kv-row, empty-state, dialog, segmented-control), feedback (alert, spinner, skeleton), overlays (menu), and layout (table-shell, checklist-row, list-row, scroll-stack) on the create-factory + @scope contract, plus a light-dark() token set + shared tone mixin. Use when building a vanilla-web UI and reaching for any of those, or a common token set, instead of hand-rolling one.
---

# vanilla-components: shared parts for vanilla-web UIs

A concrete component library built ON the `vanilla-web` conventions (which are
the engine: ES modules, `<template>`s, `@scope`, the create-factory contract).
`vanilla-web` is the "how", and this is the "what". No build, no runtime deps.

Distribution is **copy-verbatim** (the vanilla-web way): an app copies the parts
it needs into its own tree. No package, no symlink. Re-copy to update, and
never fork in place.

## Consume

- **Tokens**: copy `tokens.css` into the app and `@import`/`<link>` it before
  component CSS. It is a superset that is drop-in for GitLandscape + Slipestein
  token names. A dark-only app sets `color-scheme: dark` at its root and every
  `light-dark()` resolves dark (zero visual change).
- **Cascade layer**: every component's CSS lives in `@layer vanilla-components`.
  Declare that layer first in your app's order so any of your own rules can
  override a component's look or layout: `@layer vanilla-components, <your
  layers>;` (for example `@layer vanilla-components, tokens, utilities, components;`).
  Colour/shape are already re-themeable through `tokens.css`. The layer is what lets
  you override the *structural* bits (a component's `flex`, `padding`, width)
  from your own layer with a plain low-specificity rule. Skip the declaration and
  layer precedence falls back to stylesheet load order, which is unstable for the
  dynamically self-loaded component CSS.
- **Tone mixin**: copy `tones.css` and `<link>` it right after `tokens.css`. It
  maps the base tone set (`tone-ok|warn|bad|info|accent`) to `--tone` in ONE place.
  Tone-bearing components consume `var(--tone)` (applied by `lib/tone.js`'s
  `applyTone`), and any raw CSS colour passed as a `tone` drives `tone-custom`
  inline. Promote a recurring custom colour into the base set by adding a token, a
  `tones.css` line, and a name in `lib/tone.js`. Nothing else changes.
- **A component**: copy `components/<name>/` into the app's `components/`
  (a sibling of `lib/`, per the vanilla-web layout: the component imports
  `../../lib/templates.js`, so that relative shape must hold). Or run
  `./vendor.sh <name> <app>/components`, which copies + stamps a provenance
  header. Needs `lib/templates.js` present (the vanilla-web canonical module),
  and the app's tsconfig `include` must cover `components/**/*.js`.
- **lib helpers**: `lib/tone.js` (the tone resolver above, required by any
  tone-bearing component), `lib/lazy.js` (`whenSized` / `onceVisible`, which defer a
  map/canvas/chart until its host is laid out / scrolled into view), and
  `lib/element.js` (`defineElement`, required by any `<name>.element.js` custom-element
  sidecar: see Declarative face). Copy alongside `lib/templates.js` + `lib/component.js`.
- Each component self-loads its own `<name>.html` + `<name>.css` on first use.
  Just `import { create<Name> }` and call it.
- **Test**: address atoms by their accessible name (`createButton` →
  `get_by_role("button", name)`, `createField` → `get_by_label`), `data-slot` for
  structural seams. Full Playwright wire-up + the interaction-hold test: vanilla-web
  `reference/testing.md`.

## Tokens (names in `tokens.css`)

`--bg --bg-elev --bg-elev-2 --line/--hairline` · `--text --text-dim` ·
`--accent --ok --warn --bad --info` · `--sans --mono` ·
`--space-xs|s|m|l` · `--r --r-pill`. All colours are `light-dark()`. The status
colours (`--ok/--warn/--bad/--info/--accent`) map to a per-element `--tone` once
in `tones.css` (see Consume → Tone mixin).

## Components (contract: `create<Name>(props[, signal]) → { el, …updaters }`)

| Component | Factory | Key props |
|---|---|---|
| panel | `createPanel({ head?, body?, fill?, collapsed? }[, signal]) → { el, headEl, bodyEl, setCollapsed }` | head/body take string or Node. `fill` stretches + scrolls body. Root always wires a `--toggle` custom command: a caller's own head button can `commandfor` the panel's (caller-assigned) id to collapse/expand it, no panel-side JS. Chrome/Edge ≥135 |
| stat-card | `createStatCard({ label, value, unit?, hint?, tone?, onSelect? }, signal?) → { el, update(value, hint?) }` | tone: ok\|warn\|bad\|accent. `update()` mutates in place for polled values |
| chip | `createChip({ text, tone?, dot? }) → { el, setText(text) }` | tone: ok\|warn\|bad\|info\|accent, a raw CSS colour, or neutral. `dot` = leading dot |
| status-dot | `createStatusDot({ tone?, pulse?, label? }) → { el, setTone(t), setPulse(on) }` | tone: neutral\|ok\|warn\|bad\|info\|accent or a raw CSS colour. `pulse` halo (respects reduced-motion) |
| avatar | `createAvatar({ name?, initials?, src?, size?, tone? }) → { el, setName, setSrc }` | round initials-or-image badge. Initials derived from `name`. `tone` (named or raw colour) fills it. Override `--r-pill` to square it |
| tooltip | `createTooltip(trigger, { content?, className? }, signal?) → { el, setContent, show(), hide(), dispose() }` | top-layer `popover="hint"` (feature-detected, falls back to `manual`) tethered to the trigger by CSS anchor positioning (auto edge-flip, no coordinate math). Shows on the trigger's hover/focus. Chromium 133+ for hint (125+ for anchor positioning). Interest Invokers (`interestfor`) is the `watch-don't-adopt` endgame for the show/hide triggers themselves. |
| app-bar | `createAppBar({ brand, items, current?, onSelect? }, signal?) → { el, actionsEl, setCurrent }` | top bar: brand · underline-tab nav (`<a href="#/<id>">`) · `actionsEl` slot. `setCurrent(id)` marks active. Optional per-item `accent` + trailing `chip` badge |
| side-nav | `createSideNav({ groups, current?, onSelect? }, signal?) → { el, setCurrent }` | grouped left-pane nav. `journey` group variant = numbered pipeline + done-checks. Item `chip` composes the chip atom |
| view-header | `createViewHeader({ eyebrow?, title, sub?, actions?, dense? }) → { el, actionsEl, setTitle, setSub }` | stage header: eyebrow · title · sub · `actionsEl` slot. `dense` = compact one-line section/toolbar bar |
| button | `createButton({ label, variant?, size?, icon?, href?, target?, onClick?, disabled?, pressed? }, signal?) → { el, setLabel, setDisabled, setPressed }` | variant: default\|primary\|danger\|ghost, size: md\|sm. `href` renders an `<a>` styled as a button. `pressed` = aria-pressed toggle |
| field | `createField({ label, type?, value?, placeholder?, hint?, options?, required?, hideLabel?, onInput? }, signal?) → { el, control, getValue, setValue }` | type: text\|number\|email\|password\|search\|select\|textarea. `hideLabel` → label-less (aria-label kept) for toolbars. Native `:user-invalid` styling |
| code-input | `createCodeInput({ length?, type?, autoFocus?, onComplete?, onInput? }, signal?) → { el, getValue, setValue, clear, focus }` | multi-cell OTP/code entry: arrow/backspace nav, paste-to-fill, `onComplete` at full length, type: numeric\|text. Any resend/cooldown is the caller's |
| progress | `createProgress({ value, max?, tone?, label? }) → { el, setValue(value, max?) }` | track+fill meter, tone: ok\|warn\|bad\|accent |
| kv-row | `createKvRow({ label, value, tone? }) → { el, setValue(value) }` | key·value line (prop is `label`, `key` is React-reserved). `tone` colours the value |
| empty-state | `createEmptyState({ icon?, title, detail? }) → { el }` | centered "nothing here" placeholder |
| alert | `createAlert({ tone?, title?, message, dismissible?, onDismiss? }, signal?) → { el, setMessage, dismiss }` | inline banner. Tone colours border/fill/title. `role=alert` for bad, else status. Dismiss is a `--dismiss` custom command: the ✕ wires through `commandForElement` (no id needed), and an external caller button can too through `commandfor` on an id it sets on the root. Chrome/Edge ≥135 |
| spinner | `createSpinner({ size?, label? }) → { el }` | indeterminate ring. Colour = currentColor. Slows (not freezes) under reduced-motion |
| skeleton | `createSkeleton({ variant?, lines?, width?, height? }) → { el }` | shimmer placeholder, variant text\|block\|circle. Static under reduced-motion |
| segmented-control | `createSegmentedControl({ options, current?, onSelect? }, signal?) → { el, setCurrent }` | radio/toggle group. An option's `tone` (named or raw colour) colours it when active, else accent. `setCurrent(id)` marks active |
| menu | `createMenu(trigger, { items, onSelect?, align? }, signal?) → { el, open(), close(), dispose() }` | popover action list anchored to the trigger (a `<button>` toggles it natively). Items `{ id, label, icon?, disabled?, danger? }` or `"separator"`. Light-dismiss + Esc. Chromium 125+ |
| dialog | `createDialog({ title?, body?, actions?, scroll?, closeOnBackdrop? }, signal?) → { el, bodyEl, actionsEl, open(), close(), setTitle }` | native `<dialog>`. Append `el`, then `open()`/`close()`. `scroll` caps height + scrolls a long body. `closeOnBackdrop` → native `closedby="any"`. ✕ + `actions` buttons close through Invoker Commands (`command="close"` `commandfor={el.id}`, no JS). `setTitle` updates the header |
| table-shell | `createTableShell({ columns, rows?, caption? }) → { el, tbody, setRows }` | tokenized table skeleton: sticky header from `columns`, caller-fillable `tbody`. Numeric columns (`align:"end"`) right-aligned mono |
| checklist-row | `createChecklistRow({ text, done?, onToggle? }[, signal]) → { el, setDone(done) }` | done/undone item: box marker + strikethrough/dim when done. Owns no button itself: a caller-authored one drives a `--toggle` custom command on the row's root. Chrome/Edge ≥135 |
| list-row | `createListRow({ title, meta?, leading?, trailing?, href?, onSelect? }, signal?) → { el, setTitle, setMeta }` | leading·title+meta·trailing row. Renders `<a>` (href) / `<button>` (onSelect) / `<div>`. `leading`/`trailing` take a string or Node. Draws its own top divider between rows |
| scroll-stack | `createScrollStack({ children? }) → { el, append }` | a container that OWNS its overflow and lays children at natural height: the STACK complement to `panel.is-fill` / `table-shell` (which scroll ONE box). Stops stacked `overflow:clip` panels (every `panel` is) silently squishing + clipping with no scrollbar on a short viewport. `min-height:0` is load-bearing |

Tones derive from one `--tone` custom property through `color-mix`. The base set is
mapped once in `tones.css` and applied by `lib/tone.js`'s `applyTone(el, tone)`:
pass a named tone, a raw CSS colour (→ `tone-custom`, set inline), or neutral.
Restyle by overriding the token, not the rule.

**Sync-create path (for polled views):** every component is wired through
`defineComponent` (`lib/component.js`) and so exports `warm<Name>()` (await once at
mount) + `create<Name>Sync(props[, signal])` (a synchronous build) so it can be
created inside a `renderRegion`/`reconcileList` rebuild. `create<Name>()` is just
the async `warm + Sync` wrapper.

**Lifecycle & cleanup:** the `signal` is load-bearing, not optional. Every
component binds its listeners with `{ signal }` and the imperative ones
(`tooltip`, `menu`) wire `dispose()` to `signal` abort, so passing the mount
signal makes teardown structural and **omitting it leaks** every listener (and the
top-layer tip/menu node) on each create/destroy. A component built **per tick** in
a `reconcileList`/`renderRegion` rebuild must take a *per-tick* `AbortController`,
not the long-lived view signal, or its teardown callbacks accumulate on the signal
until the view unmounts. Guarded by `lib/lazy.leak.test.mjs` (node) and
`testing/tests/e2e/memory-*` (browser). See `vanilla-web/reference/testing.md`.

**Shell components** (`app-bar`, `side-nav`, `view-header`) are registry-driven and
follow the vanilla-web hash convention: they render `<a href="#/<id>">` and expose
`setCurrent(id)`, and the app keeps owning its `hashchange` loop. They also pick ONE
house look, so adopting them converges an app's existing nav styling (a deliberate
visual change, not a pure drop-in).

`side-nav` models **navigation**: each item is a single `<a>` (`lead · label ·
chip`). A *live status list* is not navigation and does not fit it. Such a list
has rows with a status dot, a per-host accent, and its own per-row actions, for
example a fleet rail with open and preview buttons. There is no per-row action
slot, and nesting buttons inside the item's `<a>` is invalid. Keep that a custom
component (it can still
compose these atoms: `status-dot`, `chip`, `button`).

## Declarative face: custom elements (opt-in)

Every **leaf atom** (scalar-prop, no Node/array child) also ships a
`<name>.element.js` sidecar that registers a **light-DOM** custom element, so it can be
authored in HTML instead of through `create<Name>()`: readable static markup, same factory
underneath (the tag is a face, never the primary contract):

```js
import "…/components/button/button.element.js";        // importing registers the tag
```
```html
<vc-button label="Generate" variant="primary"></vc-button>
```

Light DOM (no Shadow DOM) → `tokens.css` / `@layer` / `@scope` reach the built node
exactly as for a factory-mounted one. `defineElement` (`lib/element.js`, copy alongside
`lib/templates.js`) maps scalar / `booleans` / `numbers` attrs → props and callback
props → bubbling CustomEvents (for example `onDismiss`→`dismiss`). A native `click` already
bubbles through the host, so no mapping for those. Only **setter-backed
attrs are live** (react to change), and the rest are read once at connect. Teardown is
structural: `disconnectedCallback` aborts the mount signal (the omit-the-signal leak
above cannot happen), and an empty `connectedMoveCallback` stops a `reconcileList`
`moveBefore` from tearing down + rebuilding a moved `<vc-*>`. Both are browser-tested:
`testing/tests/e2e/memory-vc-lifecycle` (connect/disconnect leaves no survivors) and
`vc-reconcile-move` (a moved row keeps its built node, focus and state).

Tags (live attrs **bold**): `vc-button` (**label disabled pressed**), `vc-chip`
(**text**), `vc-status-dot` (**tone pulse**), `vc-avatar` (**name src**), `vc-progress`
(**value**), `vc-kv-row` (**value**), `vc-empty-state`, `vc-spinner`, `vc-skeleton`,
`vc-checklist-row` (**done** · `vc-toggle` event), `vc-stat-card` (**value**), `vc-alert`
(**message** · `dismiss` event).

**No tag** (Node / array / callback props do not fit string attributes, factory only):
panel, dialog, menu, tooltip, side-nav, app-bar, view-header, table-shell, scroll-stack,
list-row, segmented-control, field, code-input.

## Run the catalogue

`node serve.mjs` → `http://127.0.0.1:8080/preview.html` (regenerates the preview
registry on startup, and theme toggle exercises light/dark). The typecheck gate is
`tsc --noEmit -p tsconfig.json`, and every module is `// @ts-check` + JSDoc.

## Toolkit sync (maintainers)

The files on `sync-from-web.sh`'s `PAIRS` allow-list are **vendored from the
`vanilla-web` skill** (the canon): committed copies stamped
`canonical source: vanilla-web/<path>@<rev> sha256:<hash>`. The hash is of the canon
bytes the copy carries, so `vanilla-web/tools/check-vendored.mjs` tells stale from forked
without trusting the rev. Edit them in `vanilla-web`, then re-run `./sync-from-web.sh`. A
repo-local pre-commit hook (`sync-from-web.sh --precommit`) blocks the commit if a copy
drifts. See `docs/adr/0001-vendored-toolkit-not-symlink.md` and
`docs/adr/0004-vendored-copy-identified-by-content-hash.md`.

## Add a component

1. `components/<name>/<name>.{html,css,js}`: author a synchronous `build<Name>`, then
   `export const { warm: warm<Name>, sync: create<Name>Sync, create: create<Name> } =
   defineComponent(import.meta.url, "<name>", build<Name>)` (copy any component).
2. `node previews/new.mjs <name>` seeds `<name>.preview.js`. Fill in `variants`.
3. `node serve.mjs` regenerates `previews/registry.js` and serves it.
4. `components/<name>/<name>.bridge.mjs` exports `default { props, shim? }`, the
   design-sync contract (narrowed `Props` body, `shim` for `tooltip`/`dialog` if imperative).
   The bridge discovers components by walking `components/`, so a real component missing
   its sidecar fails `emit-adapter.mjs` loudly instead of vanishing silently from
   design-sync (opt out with `{ skip: true }` for one design-sync cannot render).
   Imperative components set a `shim` (`tooltip`/`dialog`/`menu`). The design-sync
   preview cards (`.design-sync/previews/*.tsx`) are generated from each component's
   `.preview.js` by `bridge/gen-previews.mjs`, not hand-authored.

A **tone-bearing** component takes a `tone` prop and calls `applyTone(el, tone)`
(`lib/tone.js`). Never hard-code status colours, and the base set lives in `tones.css`,
and the component's CSS consumes neutral as `var(--tone, <default>)` (not a
`:scope { --tone }` rule, so the global mapping wins for a toned element).

Out of current scope (candidates for later): richer factories (legend, scrubber),
chart/sparkline primitives, and TapScribe's idiom migration (it is BEM + different
token names today). `bridge/` holds the claude.ai/design bridge: `emit-adapter.mjs`
generates a React-shim adapter package the design-sync converter consumes (the
library is synced to the "Vanilla Components" project: see `.design-sync/NOTES.md`).
