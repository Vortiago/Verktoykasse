# CSS — @scope per component, tokens in @layer

Read this when writing `shell.css` or any view/component stylesheet.

- `shell.css` holds design tokens and the few utilities, layered so component
  styles always win without specificity games:

  Tokens use `light-dark()` so one block carries both themes — the OS preference
  picks the side by default, and a manual override is just `color-scheme` on the
  root element: the canonical `shell.js` wires a 3-state auto/light/dark toggle
  (persisted in localStorage) to `<button id="theme">` whenever the shell markup
  has one.

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
  @media (prefers-reduced-motion: reduce) {   /* motion is opt-out; see below */
    ::view-transition-group(*),
    ::view-transition-old(*),
    ::view-transition-new(*) { animation: none !important; }
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
  component stays self-contained wherever it's placed. Viewport `@media` only for
  page-level shell layout (collapsing the header nav, etc.).
- View CSS loads via `loadCSS(import.meta.url, "./style.css")` in `mount()`,
  removed in `unmount()`.
- Derive shades instead of hand-picking them:
  `color-mix(in oklch, var(--accent), transparent 85%)` for washes, hovers, and
  surfaces — one accent token, not five near-duplicates.
- Headings get `text-wrap: balance`, prose `text-wrap: pretty` — set once in the
  utilities layer.
- State styling through `:has()` when the DOM already knows:
  `.row:has(:checked)`, `form:has(:user-invalid) .submit` — not a JS class toggle.
- Motion is opt-out globally: `shell.css` ends with the
  `prefers-reduced-motion: reduce` block above, which zeroes the
  `::view-transition-*` animations (add any overlay entry animations there too).
  View transitions are *triggered* from JS — `withTransition()` (templates.js,
  → `reference/interactivity.md`), for user-initiated changes only — but styled
  here: the crossfade lives in `::view-transition-old/new/group`, and elements
  that should morph across the change carry a shared `view-transition-name`.
- Never: inline `style=` in templates (a CSS var + class instead), shadow DOM,
  BEM prefixes, CSS-in-JS. These are local-first tools for evergreen browsers;
  old browsers are out of scope.

## Long lists — `content-visibility`, not a JS virtual scroller

For a list that can hold hundreds–thousands of rows (a file list, a log, a feed),
don't reach for a windowing library. Two pieces, one CSS and one JS, keep it
snappy without ever leaving plain DOM:

- **CSS does the virtualization.** Put `content-visibility: auto` on each row;
  the browser skips layout AND paint of off-screen rows (it pre-renders a
  ~50%-viewport margin). Pair it with `contain-intrinsic-size: auto <h>` so a
  skipped row reserves the right height — `auto` makes the browser *remember*
  each row's last real height, so even variable-height rows (an expanded
  `<details>`) get an accurate placeholder once seen. Unlike
  `content-visibility: hidden`, the `auto` rows stay focusable, selectable, and
  find-in-page-searchable. Baseline since Safari 18 (Sep 2024).

  ```css
  @scope (.filelist) {
    .row { content-visibility: auto; contain-intrinsic-size: auto 38px; }
  }
  ```

- **`reconcileList` does the updates** (see `lib/templates.js` /
  `reference/modules.md`): never `replaceChildren` a long list on a live update
  (SSE or poll) — rebuilding thousands of nodes is the jank. Reconcile keyed, in
  place, and
  gate the call so it runs only when the row SET actually changes (a cheap
  list-signature), not every tick; apply volatile per-row state (a selection
  highlight) in place so picking a row never rebuilds it. `content-visibility`
  skips off-screen *rendering*; it does NOT skip node *creation*, so the lazy
  fetch + the don't-rebuild-every-tick discipline are what keep creation bounded.

This is the native, dependency-free equivalent of a virtual list, and it
composes with the interaction-hold rules (`reference/interactivity.md`): no row
recycling means a focused control or mid-copy selection inside a surviving row
is never destroyed.

## Carousels — scroll-snap + marker/button pseudo-elements, no slider JS

A scroll-snap row already gives swipe + snap for free; the pieces that used to need
JS — the dot indicators and the prev/next buttons — are now browser-generated
pseudo-elements. No slide-index state, no click handlers.

```css
@scope (.carousel) {
  :scope {
    display: flex; overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-marker-group: after;                 /* browser emits the dot group */
  }
  .slide { flex: 0 0 100%; scroll-snap-align: center; }
  .slide::scroll-marker {                        /* one dot per slide */
    content: ""; inline-size: 0.6rem; block-size: 0.6rem;
    border-radius: 50%; background: var(--text-dim);
  }
  .slide::scroll-marker:target-current { background: var(--accent); }
  :scope::scroll-button(inline-start) { content: "‹"; }
  :scope::scroll-button(inline-end)   { content: "›"; }
}
```

The dots track the active slide via `::scroll-marker:target-current` and take arrow
keys — all native. Chrome/Edge ≥135. Gotcha: the `::scroll-button(next|prev)`
keyword values aren't implemented anywhere — use directional keywords
(`inline-start`/`inline-end`/`up`/`down`/…). Unsupported engines fall back to a
plain scroll-snap strip (still swipeable), so it's a safe enhancement.

## Scroll-driven effects — `animation-timeline`, not IntersectionObserver

A reading-progress bar or a reveal-as-it-enters animation is a CSS animation bound
to a scroll/view timeline, not JS measuring `scrollY` or an `IntersectionObserver`
toggling classes. It runs off the main thread with zero listeners.

```css
@scope (.reader) {
  .progress {
    animation: grow linear;
    animation-timeline: scroll(root block);     /* page scroll drives it */
  }
  .card {
    animation: reveal linear both;
    animation-timeline: view();                 /* each card's own viewport overlap */
    animation-range: entry 0% cover 30%;
  }
}
@keyframes grow   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes reveal { from { opacity: 0; translate: 0 1rem; } }
```

Chrome/Edge ≥115. The shell's `prefers-reduced-motion` block already disables it
there; and since an unsupported engine just skips the animation, keep the resting
state usable without it.

## Stacked cards taller than the viewport — give the stack a scroll path

A flex child defaults to `min-height: auto`, but a surrounding flex COLUMN with
negative free space shrinks it anyway. When that child is an `overflow: clip` /
`hidden` surface — every `panel` is — the shrink CLIPS its content and produces
NO scrollbar: each box shrinks to exactly fit, so nothing overflows the column
and nothing scrolls. The symptom is "cards squished, the Save button cut off, and
you can't scroll to it" — and it hides on a tall dev monitor, only biting on a
short laptop viewport.

Rule: a stack of cards that can exceed the viewport must have ONE element that
owns the scroll path. Two shapes:

- **One tall region** → let a single fill panel own it (`panel.is-fill`, or
  `min-height: 0; overflow: auto` on its body). The OTHER, non-fill blocks in the
  column must be rigid (`flex: none`) so the fill region — not a clip box —
  absorbs the squeeze; once it bottoms out, the leftover overflow falls to the
  column's own scroll instead of clipping a rigid sibling.
- **Several natural-height cards, no single fill region** → wrap the whole stack
  in a container that owns the overflow and lays its children out at natural
  height: `flex: 1 1 auto; min-height: 0; overflow-y: auto` — the `scroll-stack`
  primitive in `vanilla-components`.

`min-height: 0` is the load-bearing line on both the column and the scroller —
omit it and the shrink can't happen, so the scroll can't either. Never leave
`clip` / `hidden` boxes as direct flex children of a column with no scroll owner.
The regression net is the layout-reachability test in `reference/testing.md`.
