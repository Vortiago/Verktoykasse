# Interactivity — re-renders, overlays, forms

Read this when a view polls/refreshes data, has menus/modals, or has forms.

## Re-renders — guarded by default (the no-flicker rule)

Polled UIs clobber open dropdowns, focused inputs, and text selections when they
swap DOM. The rule set, in order of preference:

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

Apps with polling + interactive controls should carry an e2e clobber guard: a
test that focuses every control, crosses a poll tick, and fails if a node was
rebuilt under the focus.

## Overlays — native dialog and popover, never hand-rolled

No DIY absolutely-positioned overlay divs with open/close state in JS:

- **Modals**: `<dialog>` + `dialog.showModal()` — focus trap, ESC-to-close,
  `::backdrop`, top layer, all free.
- **Dropdowns / menus / tooltips**: the `popover` attribute + `popovertarget` on
  the trigger button — zero JS for open/close, light-dismiss (click-outside, ESC)
  built in.

  ```html
  <button popovertarget="run-menu">⋯</button>
  <div id="run-menu" popover class="menu">…</div>
  ```

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
  open (same guard as focus/selection), so polled re-renders can't snap an open
  menu shut.

## Forms — native validation, no form layer

- Constraints live in markup: `required`, `pattern`, `min`/`max`, `maxlength`,
  the right `type=`. Submit handlers call `form.reportValidity()` and read
  `new FormData(form)` — always a real `<form>`, so Enter-to-submit and validation
  come free.
- Invalid styling uses `:user-invalid` / `:user-valid` — they fire only after the
  user touches a field, so nothing is red on first paint.
- Input UX is markup too: `inputmode`, `enterkeyhint`, and `autocomplete` with
  real tokens (`email`, `one-time-code`, `current-password`).
