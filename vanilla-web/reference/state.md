# State — the unidirectional-flow rule for high state-density views

Read this when a view has several regions that all depend on the same piece of
state (filters that affect a table, a count chip, a reset button's disabled
state, an empty-state) — the point where the manual-updater model's wiring cost
stops being boilerplate and starts being a correctness risk.

## The rule

> **An event handler never touches DOM — it only writes state.** Every
> dependent region subscribes once, at `mount()` (with the mount `signal`),
> rendering through the existing paths (`renderRegion` with a `sig`,
> `reconcileList`, or an in-place updater).

The failure mode this prevents isn't boilerplate, it's **consistency wiring**:
without the rule, one filter change touches the table, the count chip, the
reset button, and the empty-state — four updater calls, repeated in every
handler that touches filters. Forget one call in one handler and the UI goes
inconsistent, and the omission is invisible in review (`O(handlers × regions)`
wiring that grows one innocent line at a time). With the rule, a handler that
writes DOM directly is *itself* the bug — a single, greppable violation instead
of a missing call buried in a diff.

## `lib/state.js` — `createState(initial)`

The synchronous, view-local sibling of `store.js` (`createStore`): where a
store outlives view re-mounts, `createState` lives for exactly one mount.

```js
const filters = createState({ status: "all", query: "" });
filters.get();                            // current value
filters.set({ ...filters.get(), query }); // replace + notify
filters.update((s) => ({ ...s, query })); // functional patch + notify
filters.subscribe(renderTable, signal);   // signal-scoped, per store.js convention
```

`notify` is batched through `queueMicrotask`, so a handler doing three writes
renders each subscriber once, not three times. Subscriptions take the mount
`signal` — the same structural-teardown contract as everything else in the
toolkit (`store.subscribe`, `loadCSS`, `every`) — so a re-mounting view can't
pile dead callbacks into the subscriber set.

## The escalation ladder

Pick the lightest rung that stays correct; move up only when the trip-wire
fires. An LLM authoring a view can apply this mechanically instead of guessing:

1. **Scattered in-place updaters** — a stat card, a chip. Today's default model,
   still correct at low density.
2. **One `render()` per view** that every handler calls after mutating a plain
   state object. Medium density, zero new library code.
3. **`createState` + per-region subscriptions.** Interdependent widgets — the
   rung this doc is about.
4. **React** — per the top-level decision rule in `SKILL.md`, when even (3)
   creaks (heavy shared state across many screens, a component ecosystem the
   task genuinely needs).

## Trip-wires

This limit arrives gradually and is easy to sail past — watch for:

- **one handler calls more than ~2 updaters** — move to the next rung;
- **two handlers update the same region** — that region's rendering belongs in
  one subscriber, not duplicated per handler.

## Deliberately out of scope

- **Auto-tracked signals** (Solid/Vue-style, or the TC39 Signals proposal) —
  the "proper" fix, and roughly zero-dep-sized, but dependency tracking is
  invisible magic: the opposite of copy-verbatim readability, and a second
  state model to teach. Noted here as the platform-aligned future — TC39
  Signals is stage 1 as of this writing; if it ships, `createState` becomes a
  deletable shim with the same shape philosophy as the `moveBefore` fallback
  in `reconcileList`.
- **Derived/computed stores, selectors, memoization** — compute inside the
  subscriber; lift a `derived()` helper only after two apps have hand-written
  one (the repo's own two-apps-before-lifting rule).
- **Any change to the component contract** — components stay dumb
  (`create<Name>(props, signal) → { el, …updaters }`); `createState` lives in
  views, which is where the interdependence problem lives.

## Honest residual limits

A state write re-renders every subscribed region — the existing `sig` option on
`renderRegion` gates the wasted swaps, but fine-grained performance still needs
a manual in-place updater where it matters. And this is still convention rather
than compiler: nothing stops a handler from touching DOM directly except the
rule being followed. What it buys over the plain manual-updater model is that
it's *one* convention with *one* grep (`renderRegion`/`reconcileList` calls
inside an event handler body, rather than inside a subscriber) — the difference
that matters when the toolkit's primary author is an LLM session rather than a
human who remembers the last review comment.
