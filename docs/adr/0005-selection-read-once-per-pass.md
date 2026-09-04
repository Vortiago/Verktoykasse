# 0005: The selection read is taken once per synchronous pass

- Status: Accepted
- Date: 2026-09-04
- Deciders: Atle

## Context

**Issue #83**, from a consumer that vendors `render.js`. `selectionInside` reads
`Selection.isCollapsed`, `rangeCount` and `getRangeAt`. In Blink each of those forces a
synchronous style and layout update, because selection state depends on layout.

`renderRegion` asks once per host through `_holdCause`. The seam mutates the DOM between
hosts, so each host re-dirties layout and pays a fresh flush. In the reporting app this was
the largest single cost on the main thread, and a profile attributed a large share of
non-idle time to it. No DOM-identity test sees any of it, because nothing is rebuilt. The
cost is in the asking.

The docs made it worse. The `heldInside` JSDoc, and its mirror in
`reference/interactivity.md`, recommended `selectionInside` as the cheaper per-tick guard,
on the grounds that it short-circuits on a collapsed selection. Reading `isCollapsed` is
what triggers the flush, so that short-circuit is the expensive path, and the overlay
guard it was compared against forces no layout at all.

## Decision

- **One selection read per synchronous pass.** `render.js` keeps a module-level snapshot
  of the selection's `Range` objects, filled on the first ask of a pass and cleared by a
  microtask. Microtasks drain only once the stack unwinds, so every host asked in one
  synchronous pass shares the answer, and the next pass asks again.
- **The snapshot holds ranges, never the live `Selection`.** Reading the `Selection` is the
  cost, so handing it back would only move the flush to the caller. `intersectsNode` is the
  sole consumer, it forces no layout, and a `Range` follows the DOM mutation the seam
  performs, so a snapshotted range still answers correctly for a host rendered later in the
  pass. `anchorNode` and `focusNode` are not snapshotted: nothing reads them, and both are
  themselves flush-forcing getters.
- **`heldInside` answers for the current synchronous pass**, where 0002 said the current
  moment. A pass that changes the selection itself, after its own first ask, keeps the
  earlier answer until the stack unwinds.
- **The flush is deferred, never missed.** The browser queues `selectionchange` as a task,
  so a listener never runs inside the microtask checkpoint that took the snapshot, and its
  first read is fresh. A stale "held" therefore defers a swap to the next
  `selectionchange`, which the change that cleared the selection queues itself.
- **The opposite exposure is accepted.** App code that creates a selection and renders a
  host it touches, inside one synchronous stack, reads a stale empty snapshot and swaps
  under the selection. A user-driven selection change always arrives as its own task, so
  this needs the app to do both in one stack. That is the app's own ordering.
- **The docs name `heldInside` as the default guard.** `selectionInside` is the narrower
  question, not the cheaper one, and it suits only a host that can hold neither focus nor
  an overlay.
- **0002's rejection of module-level configuration stands.** A bounded, self-clearing cache
  is not the `configureRender` knob 0002 refused. It holds no policy, exposes no API, and
  is unobservable across passes.
- **`_holdCause` keeps its order.** The selection read stays last, behind the focus and
  overlay guards, so the first host in a pass to reach it pays the one flush.

## Consequences

- A retry loop that asks about many hosts should ask them in one synchronous pass. An
  `await` between hosts starts a new pass and a new read.
- The module gains its first piece of state that is not keyed by host. It clears itself on
  a microtask, so it cannot outlive the pass that filled it.
- A test double that re-reads the selection inside one synchronous stack now sees the
  earlier answer. Three tests in `render.test.mjs` cross the pass boundary by hand for
  exactly the reason a browser crosses it on its own.

## Alternatives considered

- **Snapshot only "is there a selection at all".** Rejected: it fast-paths the idle case
  and leaves the held case, the one the hold exists for, paying `rangeCount` and
  `getRangeAt` per host. An idle-only test stays green against it, which is why the count
  test runs with a live selection.
- **Hand back the live `Selection` from the snapshot.** Rejected: reading it is the cost,
  so this moves the flush rather than removing it.
- **Clear on `requestAnimationFrame` instead of a microtask.** Rejected: a frame spans many
  tasks, so a `selectionchange` listener could read a snapshot taken before the change and
  hold a region past the event that should release it.
- **A test-only reset export.** Rejected on 0002's ground: surface in a copy-verbatim
  module for one caller's convenience. The node tests await one microtask turn instead,
  which is the same boundary the browser has.
- **A caller-supplied snapshot, passed into `renderRegion`.** Rejected: every caller would
  re-implement the read and the pass boundary, which is the drift 0002 exists to prevent.

## Notes

`render.test.mjs` counts hits on a selection double across three hosts in one pass, with a
live selection, and asserts the pass asks once per member. It then awaits a microtask and
asserts the next pass asks again. `testing/tests/e2e/render-hold.spec.js` repeats the count
against the real `Selection.prototype` getters over two regions, one held and one swapping.
Both are verified to fail against the pre-#83 module.
