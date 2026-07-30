# 0002 — The interaction hold is a shared predicate, and a held swap has exactly one owner

- Status: Accepted
- Date: 2026-07-30
- Deciders: Atle

## Context

`render.js` is canon for interaction-safe re-rendering: `renderRegion` refuses to swap a
host's DOM while a person is mid-interaction inside it (a control focused, a
popover/`<dialog>` open, a text selection touching it) and lands the swap the instant that
clears. Both halves of that were baked into the one function.

Issue #72 was filed by a consumer (TapScribe) that vendors the file, and reported two
things that turned out to be one shape:

1. The `focusout` listener that flushed a focus-deferred swap re-entered `renderRegion` to
   re-run the guards — but `focusout` fires *before* the incoming element is focused, and
   `document.activeElement` is `<body>` for its whole duration. Every guard passed, so the
   swap landed on top of whatever was about to receive focus. Reproduced in headless
   Chromium: Tab between two inputs in one region and the region is rebuilt, losing the
   element being focused.

2. A polled app has four render shapes and only one of them can use a listener-based flush.
   A `reconcileList` driven by materialized items must re-derive from live state, not replay
   a captured build; an in-place updater that rewrites text every tick has no build closure
   to replay; a selection straddling a host has no event of its own. The consumer landed
   those three through its own tick-retry flag — which meant **two hold registries keyed on
   the same host**. They diverge: canon's pending entry freezes at its tick's build while
   the app's absorbs newer ones, then canon's flush swaps the stale build in behind it. The
   consumer's resolution was to pre-empt every branch and hand `renderRegion` only the swap,
   re-implementing all three guard predicates app-side — exactly the drift copy-verbatim
   vendoring exists to prevent (ADR 0001).

## Decision

Separate the *question* from the *answer*, and give the answer a single owner.

- **One definition of held.** An internal `_holdCause(host)` is the sole copy of the
  focus/overlay/selection decision. `renderRegion` switches on its cause to arm the matching
  flush listener; `heldInside(host)` is its exported boolean face. Neither can drift from
  the other because there is only one of them. `selectionInside` remains exported as the
  narrower selection-only face.

- **The deferral strategy is the caller's choice.** `renderRegion` returns whether the
  region was **held**, and `defer:false` reports the hold without arming anything. An app
  that already owns a tick-retry loop now shares canon's predicate instead of reproducing it.

- **Exactly one owner per host, enforced on the call.** A `defer:false` call aborts and drops
  any self-flush an earlier `defer:true` call left armed, so the divergence in (2) cannot
  survive a host that keeps coming through `renderRegion`. Note the limit of that guarantee:
  disowning happens *on the call*, so a host this module has ever deferred must keep being
  routed through `renderRegion` (with `defer:false`) rather than skipped by a bare
  `heldInside` early return — which cannot reach the pending entry. The early-return shape is
  for the hosts `renderRegion` never renders (a `reconcileList` target, an in-place updater),
  where there is no registry to disown. There is deliberately no separate "release this host"
  export: the issue asked for a shared predicate and an injectable strategy, not a lifecycle.

- **The return value is "held", not "swapped"** — deliberately, so that a sig-unchanged skip
  returns `false`. A skip is a no-op with nothing to retry; had the value been "swapped", a
  consumer's `while (!swapped) retry` loop would spin forever on an unchanged signature.

- **The flush guard asks about containment, not the hold predicate.** The `focusout` flush
  proceeds only when `relatedTarget` is absent or outside the host — deliberately *not*
  `_holdCause` evaluated against the incoming element. The entry guard holds only for
  *controls*, but a swap must not land on **any** incoming focus inside the host. This
  asymmetry is what keeps a `<button>` inside a held region clickable: Chrome focuses a
  button on mousedown, so a flush there removes the node before its `click` can fire.

## Consequences

- **A consumer with its own retry loop has one definition of "held" to trust**, including
  parts a hand-rolled guard would miss — such as the overlay branch's MutationObserver
  fallback for an overlay removed without firing `close`/`toggle`.
- **`renderRegion`'s signature widened compatibly.** `void` → `boolean` breaks no caller, and
  `() => boolean` stays assignable where `withTransition` wants `() => void`.
- **The asymmetry has a bounded cost, accepted:** focus parked on a non-interactive element
  inside a host leaves the region stale until focus moves again — self-healing on the next
  `focusout`, and superseded by the next direct call on a polled app. Strictly better than
  the clobber it replaces.
- **The entry guard still does not hold for non-interactive focus.** A polled tick will
  rebuild a region under a focused `<button>`. That is deliberate: an indefinite hold on a
  focused button would freeze the region for as long as it keeps focus.
- **`selectionInside` now asks `Range.intersectsNode`**, a strict superset of the old
  endpoint test — every selection that held before still holds, plus the range that spans
  the host with neither endpoint inside (⌘A over a panel).
- **Cost:** two new exported names and one more option on the most-used function in the
  toolkit, plus a real-browser spec (`testing/tests/e2e/render-hold.spec.js`) because none of
  the above can be proved against hand-written test doubles.

## Alternatives considered

- **Leave it; let each consumer pre-empt the guards.** Rejected: that *is* the reported
  problem. It puts the predicates in two places, and the copy drifts from canon the moment
  canon learns something new.
- **Export the predicate only, no `defer` option.** Rejected as insufficient: a consumer
  checking `heldInside(host)` before calling still hands a held host to `renderRegion` if the
  interaction starts in between, and canon then arms its own registry alongside the app's.
  The option is what closes the hazard rather than narrowing it.
- **An injectable `onHold(host)` callback.** Rejected: heavier than a return value for the
  one behaviour actually needed, and it invites deferral strategies nobody asked for.
- **A module-level default (`configureRender({ defer: false })`).** Rejected: hidden global
  state in a copy-verbatim module. An app that wants it everywhere wraps the call —
  `const render = (h, b, sig) => renderRegion(h, b, { sig, defer: false })`.
- **A cause enum instead of a boolean from `heldInside`.** Rejected: returning the cause
  invites consumers to switch on it and re-own per-cause logic, which is the drift again.
  `HoldCause` stays internal.
- **For the flush: `_holdCause` evaluated against `relatedTarget`.** Rejected: consistent
  with the entry guard but reintroduces the clobber for buttons and other non-interactive
  focus targets — the dead-button bug.
- **For the flush: defer past `focusout` so `activeElement` settles.** Rejected: microtasks
  drain before Chrome updates `activeElement`, so it needs `rAF`/`setTimeout`, which gives up
  the "flushes the instant the interaction clears" property and inherits worse re-entrancy.

## Notes

The hold predicates run on `document.activeElement` and `document.getSelection()`, so
`heldInside` answers for the *current* moment only — it is a question, not a subscription. A
consumer that wants to know when a hold clears either lets `renderRegion` self-flush
(`defer:true`) or re-asks on its own tick.
