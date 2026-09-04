# 0002: The interaction hold is a shared predicate, and a held swap has exactly one owner

- Status: Accepted
- Date: 2026-07-30
- Deciders: Atle

Context: **issue #72**, from a consumer that vendors `render.js`. Two findings, one shape:
the `focusout` flush landed on the incoming focus, and `renderRegion`'s baked-in deferral
strategy forced the consumer to re-implement every guard predicate app-side, leaving one host
with two hold registries that drift apart.

## Decision

Separate the *question* (is this host held?) from the *answer* (who lands the held swap?).

- **One definition of held.** Internal `_holdCause(host)` is the sole copy of the
  focus/overlay/selection decision. `renderRegion` switches on its cause to arm the matching
  flush listener. `heldInside(host)` is its exported boolean face. `selectionInside` stays
  exported as the narrower selection-only face.
- **The deferral strategy is the caller's.** `renderRegion` returns whether the region was
  **held**, and `defer:false` reports the hold without arming anything.
- **The return value is "held", not "swapped"**, so a sig-unchanged skip returns `false` and
  a consumer's `while (held) retry` loop cannot spin on an unchanged signature.
- **The sig gate runs ahead of the hold guards.** `sig` is recorded only on a swap, so an
  unchanged one proves the DOM already matches, so nothing is owed, held or not. Guards-first
  retained a build closure and a listener for the whole hold, then discarded them as a no-op.
  `markRegionStale` still forces a rebuild: it forgets the sig, so the gate cannot match.
- **Exactly one owner per host, enforced on the call.** A `defer:false` call drops any
  self-flush an earlier `defer:true` call left armed. Two deliberate limits: disowning happens
  *on the call*, so a host must keep coming through `renderRegion` (a bare `heldInside` early
  return is for hosts `renderRegion` never renders), and it binds one way only. A later
  default call re-arms, since `defer` is per-call, so the discipline is a wrapper, not a
  property of the host. No "release this host" export: #72 asked for a predicate and a
  strategy, not a lifecycle.
- **The flush guard asks about containment, not the predicate**: `relatedTarget` absent or
  outside the host. The entry guard holds only for *controls*, but a swap must not land on
  **any** incoming focus inside the host: Chrome focuses buttons on mousedown, so a flush
  there removed a `<button>` before its `click` could fire. Accepted cost: focus parked on a
  non-interactive element leaves the region stale until focus moves again. The entry guard
  still does not hold for a focused `<button>`, and an indefinite hold there is worse than the
  clobber.
- **`selectionInside` asks `Range.intersectsNode`**, a strict superset of the endpoint test.
  One ⌘A therefore holds every region on the page, each held host attaching its own
  document-level `selectionchange` listener. A single shared listener is the fix if it bites.

## Alternatives considered

- **Leave it, and let each consumer pre-empt the guards.** Rejected: that *is* the reported
  problem. It puts the predicates in two places, and the copy drifts the moment canon learns
  something new.
- **Export the predicate only, no `defer` option.** Rejected as insufficient: a consumer
  checking `heldInside(host)` before calling still hands a held host to `renderRegion` if the
  interaction starts in between, and canon then arms its own registry alongside the app's.
- **An injectable `onHold(host)` callback.** Rejected: heavier than a return value for the one
  behaviour actually needed, and it invites deferral strategies nobody asked for.
- **A module-level default (`configureRender({ defer: false })`).** Rejected: hidden global
  state in a copy-verbatim module. An app that wants it everywhere wraps the call.
- **A cause enum instead of a boolean from `heldInside`.** Rejected: returning the cause
  invites consumers to switch on it and re-own per-cause logic, which is the drift again.
  `HoldCause` stays internal.
- **For the flush: `_holdCause` evaluated against `relatedTarget`.** Rejected: consistent with
  the entry guard, but reintroduces the clobber for buttons: the dead-button bug.
- **For the flush: defer past `focusout` so `activeElement` settles.** Rejected: microtasks
  drain before Chrome updates `activeElement`, so it needs `rAF`/`setTimeout`, which gives up
  the "flushes the instant the interaction clears" property and inherits worse re-entrancy.

## Notes

`heldInside` reads `document.activeElement` and `document.getSelection()`, so it answers for
the *current* moment only: a question, not a subscription. A consumer that wants to know when
a hold clears either lets `renderRegion` self-flush (`defer:true`) or re-asks on its own tick.

Amended by 0005: `heldInside` and `selectionInside` answer for the current synchronous
pass, not the current call. The selection read is taken once per pass and shared.

None of the above can be proved against hand-written test doubles, which is why
`testing/tests/e2e/render-hold.spec.js` exists and is verified to fail against the pre-#72
module.
