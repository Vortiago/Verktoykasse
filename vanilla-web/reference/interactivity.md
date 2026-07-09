# Interactivity — re-renders, overlays, forms

Read this when a view shows live (SSE-driven or polled) data, has menus/modals,
or has forms.

## Declarative over imperative

Prefer a platform attribute to a JS listener — behaviour then reads off the
element. The Overlays, Actions, and Forms rules below are this applied; drop to
`addEventListener` (always `{ signal }`-scoped, so teardown is structural) only
for what no attribute covers.

## Re-renders — guarded by default (the no-flicker rule)

Live-updating UIs (SSE-driven or polled) clobber open dropdowns, focused inputs,
and text selections when they swap DOM. The rule set, in order of preference:

1. **Mutate in place** for values that change every tick (counters, clocks,
   progress, appended feed lines): update `textContent` / toggle `hidden` on
   existing nodes. No swap → nothing to clobber.
2. **Every region swap goes through `renderRegion(host, build, {sig})`** — never
   raw `replaceChildren`/`innerHTML` on polled data. It skips the swap while a
   control inside `host` is focused, while a popover or `<dialog>` inside `host`
   is open, while a text selection touches `host`, or while `sig` is unchanged; a
   deferred swap lands on the first tick after the interaction clears.
3. **Signature hygiene:** `sig` is a cheap string of exactly what the region
   renders. A fast-ticking value must never share a sig with an O(content) region
   — one progress tick must not force a 3000-row table rebuild. Separate regions,
   separate sigs.
4. **Gate at the data layer too:** skip the whole render pass when the payload is
   unchanged (compare a JSON string or ETag). With SSE (see `reference/server.md`)
   this gate moves to the server: no change → no event → no render pass at all —
   the strongest anti-flicker move is the render that never fires.
5. For in-place updaters that write text the user might be selecting, check
   `selectionInside(host)` first and defer — same rule as the focus guard.
6. **Long, keyed lists use `reconcileList`, not `renderRegion`.** Where
   `renderRegion` DEFERS a swap of a whole region while a control inside is
   focused, `reconcileList(host, items, keyOf, create, update)` updates a list
   in place around the interaction: it matches rows by key and moves survivors
   with `moveBefore()` (preserving focus, selection, scroll, animations, and an
   open `<details>`), creating only new keys and dropping gone ones. Fold a
   row's content into its key + omit `update` to recreate changed rows while
   unchanged ones keep their state. Gate the call on a cheap list-signature so
   it runs only when the row set changes, and pair it with
   `content-visibility: auto` on the rows for off-screen skipping — the native
   virtual-list recipe (see `reference/css.md`).

Apps with live updates (SSE or polling) + interactive controls should carry an
e2e clobber guard: a test that focuses every control, crosses an update (a poll
tick or a pushed event), and fails if a node was rebuilt under the focus.

## Animating a user-initiated change — `withTransition`

The rules above keep *polled* swaps invisible. The opposite case — a change a
person just triggered (switching a tab, opening a detail, expanding a panel,
sorting a column, a user-clicked add/remove) — should be *visible*: wrap the DOM
mutation in `withTransition(update)` (templates.js) and the browser crossfades between the
before and after states via the View Transition API. Style it entirely in CSS
with the `::view-transition-*` pseudo-elements; give elements that should morph
across the change a shared `view-transition-name` (e.g. a `reconcileList` row
that reorders). Chrome/Edge ≥111; where unsupported the swap just happens
instantly.

```js
tab.addEventListener("click", () => withTransition(() =>
  renderRegion(panel, () => viewFor(tab.dataset.id), { force: true })), { signal });
```

Do **not** wrap polled/SSE re-renders in it. A view transition is single-flight
per document (a new one skips the one in flight) and animates on every call, so
on a fast re-render path it produces shimmer and self-cancelling transitions —
the *trigger* decides, not the helper: a human action animates, a timer swaps
instantly through `renderRegion`/`reconcileList`. Two more notes: motion is
opt-out globally via the shell's `prefers-reduced-motion` block (see
`reference/css.md`), so `withTransition` never checks it; and `update` runs
asynchronously under a real transition, so don't read the new DOM right after
the call — `withTransition` returns the transition (a resolved-`finished` shim
where unsupported), so `withTransition(update).finished.then(() => …)` acts once
it settles (e.g. to move focus) without dropping back to the raw API.

## Pending state — attribute-driven, styled in CSS

For an *initial* or *user-triggered* load — opening a view, a submit, a
load-more — mark the target region busy and let CSS, not JS, render the busy
look. `withPending(host, work)` (templates.js) sets `aria-busy="true"` for the
life of the promise (ref-counted across overlapping calls) and clears it in a
`finally`, so a rejection can't strand the spinner; `aria-busy` also tells
assistive tech to hold partial-update announcements until the region settles. No
per-app loading-flag bookkeeping, and it composes with `renderRegion` (the
deferred swap lands when the data arrives). Background SSE/poll updates don't use
this — a busy flash every tick is exactly the flicker the no-flicker rule
prevents; they re-render silently instead.

```js
await withPending(listHost, get("/rows", { signal }));
```

```css
@scope (.list) {
  :scope[aria-busy="true"] { opacity: 0.6; cursor: progress; }
}
```

## Overlays — native dialog and popover, never hand-rolled

No DIY absolutely-positioned overlay divs with open/close state in JS:

- **Modals**: `<dialog>` + `dialog.showModal()` — focus trap, ESC-to-close,
  `::backdrop`, top layer, all free. Light-dismiss (backdrop click) is the
  `closedby="any"` attribute, not a JS backdrop-click listener.
- **Dropdowns / menus / tooltips**: the `popover` attribute + `popovertarget` on
  the trigger button — zero JS for open/close, light-dismiss (click-outside, ESC)
  built in.

  ```html
  <button popovertarget="run-menu">⋯</button>
  <div id="run-menu" popover class="menu">…</div>
  ```

- **Select-shaped dropdowns**: don't rebuild `<select>` as a div listbox just to
  style it — opt the native control into full styling with `appearance:
  base-select` (on both the `<select>` and its `::picker(select)`), put rich
  markup (icons, two-line options) straight in the `<option>`s, and mirror the
  chosen one with `<selectedcontent>`. Keyboard nav, type-ahead, ARIA, top-layer
  positioning and light-dismiss stay native — the whole custom-combobox JS
  disappears. Chrome/Edge ≥135; degrades to a plain native select where
  unsupported.

- **Buttons that open/close an overlay**: the Invoker Commands API — `command` +
  `commandfor` on a `<button>` — drives an overlay declaratively with zero JS,
  and unlike `popovertarget` it also covers `<dialog>` (open *and* close). Reach
  for it for close/confirm buttons and any trigger that isn't already a popover
  invoker, instead of an `onclick` that calls `.showModal()` / `.close()`:

  ```html
  <button command="show-modal" commandfor="confirm">Delete…</button>
  <dialog id="confirm">
    …
    <button command="request-close" commandfor="confirm">Cancel</button>
  </dialog>
  ```

  Values: `show-modal` / `close` / `request-close` for dialogs (`request-close`
  fires a cancelable `cancel`, mirroring ESC); `toggle-popover` / `show-popover` /
  `hide-popover` for popovers. The invoker must be a real `<button>`. Chrome/Edge
  only: `command`/`commandfor` ≥135, `request-close` ≥139, `closedby` ≥134 — past
  our targets, not yet Safari-stable. The same `command`/`commandfor` mechanism
  also drives non-overlay app actions → see **Actions** below.

- **Accordions / disclosure**: `<details>`; a shared `name` attribute makes a
  group exclusive-open. No accordion JS.
- Anchor a dropdown to its trigger with CSS anchor positioning (`anchor-name` /
  `position-area`) — but it's not in Firefox/Safari stable yet, so for menus that
  must work everywhere, position on the `beforetoggle` event in JS instead
  (`anchorPopover`, see `reference/modules.md`).
- Open/close animation is pure CSS: `@starting-style` for the entry state,
  `transition-behavior: allow-discrete` so `display` can transition — no JS
  animation hooks.
- `renderRegion` defers swaps while a popover or `<dialog>` inside the host is
  open (same guard as focus/selection), so live re-renders can't snap an open
  menu shut.

## Actions — delegated commands, not a fan of `onclick`s

A `command` whose value starts with `--` (`command="--archive"`) is a *custom*
command: clicking the button fires a `CommandEvent` on the `commandfor` target
with `e.command === "--archive"` and `e.source` the button. One delegated
listener on the target replaces a fan of per-button `onclick`s, and the action
still reads off the markup (the declarative-over-imperative rule). Chrome/Edge
≥135; where unsupported the button fires no `CommandEvent` (no fallback) — wire a
plain `onclick` if the action must work off-target.

```html
<button command="--archive" commandfor="inbox">Archive</button>
<ul id="inbox">…</ul>
```
```js
inbox.addEventListener("command", (e) => {
  if (e.command === "--archive") archive(e.source);
}, { signal });
```

## Forms — native validation, no form layer

- Constraints live in markup: `required`, `pattern`, `min`/`max`, `maxlength`,
  the right `type=`. Submit handlers call `form.reportValidity()` and read
  `new FormData(form)` — always a real `<form>`, so Enter-to-submit and validation
  come free.
- Invalid styling uses `:user-invalid` / `:user-valid` — they fire only after the
  user touches a field, so nothing is red on first paint.
- Input UX is markup too: `inputmode`, `enterkeyhint`, and `autocomplete` with
  real tokens (`email`, `one-time-code`, `current-password`).
- A `<textarea>` that grows with its content is `field-sizing: content` in CSS,
  not an `input` listener writing `scrollHeight` back to the height; cap it with
  `max-block-size`. Chrome/Edge ≥123.
