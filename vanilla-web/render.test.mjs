// Functional guards for render.js — withTransition (the View Transition
// trigger) and renderRegion's deferred-flush machinery.
//
// withTransition wraps a user-initiated DOM mutation in
// document.startViewTransition when the API is present, and MUST fall back to
// running the mutation synchronously when it isn't (older engines — or a
// non-browser like this test). It returns the ViewTransition (or a
// resolved-`finished` shim in the fallback) so callers can await `.finished`
// uniformly. No jsdom: we fake the one global it touches, document, on
// globalThis — the same shape the browser provides.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTransition, renderRegion, markRegionStale, heldInside, selectionInside } from "./render.js";
import { fakeEventTarget as fakeTarget, patchGlobal } from "./testing-util.mjs";

/** @param {any} ret */
const isThenableFinished = (ret) => ret != null && typeof ret.finished?.then === "function";

test("routes the mutation through startViewTransition and returns its transition", (t) => {
  const calls = { started: 0, updated: 0 };
  const transition = { finished: Promise.resolve() };
  const doc = {
    /** @param {() => void} cb */
    startViewTransition(cb) {
      calls.started++;
      cb(); // the browser runs `update` inside the transition
      return transition;
    },
  };
  patchGlobal(t, "document", doc);
  const ret = withTransition(() => { calls.updated++; });
  assert.equal(calls.started, 1, "startViewTransition called once");
  assert.equal(calls.updated, 1, "the update ran (inside the transition)");
  assert.equal(ret, transition, "returns the ViewTransition so .finished composes");
});

test("falls back to a synchronous update when startViewTransition is missing", (t) => {
  patchGlobal(t, "document", {});
  let updated = 0;
  const ret = withTransition(() => { updated++; });
  assert.equal(updated, 1, "update ran directly with no transition available");
  assert.ok(isThenableFinished(ret), "fallback still returns a { finished } shim so callers can .finished uniformly");
});

test("falls back when startViewTransition is present but not callable", (t) => {
  patchGlobal(t, "document", { startViewTransition: null });
  let updated = 0;
  // A partial/older impl might expose the name as a non-function — must still fall back,
  // never skip the mutation (which would silently drop the user's change).
  const ret = withTransition(() => { updated++; });
  assert.equal(updated, 1, "non-callable startViewTransition falls back to a direct update");
  assert.ok(isThenableFinished(ret), "fallback returns the shim here too");
});

// ── #42: renderRegion's deferred-flush ───────────────────────────────────────
//
// A skipped swap must flush the INSTANT the interaction clears, not only "the
// first tick after" — there might not be one (a quiet SSE stream, a one-shot
// store-triggered render, a long livePoll interval). Fakes below are plain
// objects (no jsdom): fakeTarget (from testing-util.mjs) is an EventTarget-like
// double with addEventListener(type, fn, {signal, once}) + dispatch(type), a
// fake `host` (contains/querySelector/replaceChildren) and a fake `document`
// (activeElement/getSelection).

/** `_insideEl` is the ONE element tests move focus to and from (mutated in place
 * by several of them); `inside` seeds any OTHER nodes host.contains() should
 * claim — a second control, a button — which the #72 focusout tests need to say
 * "focus went from #a to #b, both inside the host".
 * @param {{ insideEl?: unknown, inside?: unknown[], overlay?: any }} [opts] */
function fakeHost({ insideEl = null, inside = [], overlay = null } = {}) {
  const target = fakeTarget();
  const host = /** @type {any} */ ({
    ...target,
    tagName: "DIV",
    isConnected: true, // real Elements always carry this; the detached-host test flips it
    _insideEl: insideEl,
    _inside: new Set(inside),
    _overlay: overlay,
    // `node != null` matters: a real host.contains(null) is false, and the
    // default _insideEl is null — without the check an absent relatedTarget
    // would read as "inside".
    contains(/** @type {unknown} */ node) { return node != null && (node === host._insideEl || host._inside.has(node)); },
    querySelector() { return host._overlay; },
    swaps: 0,
    lastNode: /** @type {unknown} */ (null),
    replaceChildren(/** @type {unknown} */ node) { host.swaps++; host.lastNode = node; },
  });
  return host;
}

/** Selection double. `crosses` names the nodes its range intersects — the question
 * a real `Range.intersectsNode` answers, and the reason it beats the endpoint test:
 * a range that merely SPANS the host crosses it while neither endpoint is inside.
 * @param {{ anchorNode?: unknown, focusNode?: unknown, crosses?: unknown[] }} [opts] */
function fakeSelection({ anchorNode = null, focusNode = anchorNode, crosses = [] } = {}) {
  return {
    isCollapsed: false,
    rangeCount: 1,
    anchorNode,
    focusNode,
    getRangeAt: () => ({ intersectsNode: (/** @type {unknown} */ node) => crosses.includes(node) }),
  };
}

/** @param {{ activeElement?: unknown, selection?: any }} [opts] */
function fakeDocument({ activeElement = null, selection = null } = {}) {
  const target = fakeTarget();
  // `body` is real here because the focus guard compares against it: during a
  // focusout dispatch the browser parks activeElement on <body>, which is the
  // whole reason the #72 flush can't read activeElement to decide.
  return { ...target, body: { tagName: "BODY" }, activeElement, getSelection: () => selection };
}

test("renderRegion: a swap deferred by focus flushes the instant focus leaves — no next tick required", (t) => {
  const input = { tagName: "INPUT" };
  const doc = fakeDocument({ activeElement: input });
  patchGlobal(t, "document", doc);
  const host = fakeHost({ insideEl: input });

  let builds = 0;
  renderRegion(host, () => { builds++; return { id: "v1" }; });
  assert.equal(host.swaps, 0, "swap skipped while a control inside host is focused");
  assert.equal(builds, 0, "build() not called on a skipped swap — cheap skip");
  assert.equal(host.listenerCount("focusout"), 1, "exactly one focusout listener armed");

  // Focus actually leaves (activeElement updates, THEN the browser fires focusout).
  doc.activeElement = null;
  host.dispatch("focusout", { relatedTarget: null });

  assert.equal(host.swaps, 1, "flushed the instant focusout fired — no further renderRegion call needed");
  assert.equal(builds, 1);
  assert.deepEqual(host.lastNode, { id: "v1" });
  assert.equal(host.listenerCount("focusout"), 0, "listener detached once it flushed");
});

test("renderRegion: repeated skips while still focused replace the pending build (latest-wins) and arm only one listener", (t) => {
  const input = { tagName: "INPUT" };
  const doc = fakeDocument({ activeElement: input });
  patchGlobal(t, "document", doc);
  const host = fakeHost({ insideEl: input });

  renderRegion(host, () => ({ v: 1 }));
  renderRegion(host, () => ({ v: 2 })); // simulates a second poll tick arriving mid-focus
  renderRegion(host, () => ({ v: 3 })); // and a third
  assert.equal(host.listenerCount("focusout"), 1, "still exactly one armed listener after three skips — no accumulation");

  doc.activeElement = null;
  host.dispatch("focusout", { relatedTarget: null });
  assert.equal(host.swaps, 1);
  assert.deepEqual(host.lastNode, { v: 3 }, "the LATEST skipped build wins; the two intermediate ones are dropped");
});

// ── #72: the focusout flush must not land on the INCOMING focus ──────────────
//
// `focusout` fires BEFORE the incoming element is focused, and for its whole
// duration document.activeElement is <body> — so a flush that re-reads
// activeElement sees an idle host, passes every guard, and swaps on top of
// whatever was about to receive focus. `relatedTarget` is the only thing in the
// event that names where focus is going, so it's what the flush must ask.

test("renderRegion: focusout that hands focus to another control INSIDE the host does not flush (#72)", (t) => {
  const a = { tagName: "INPUT" };
  const b = { tagName: "INPUT" };
  const doc = fakeDocument({ activeElement: a });
  patchGlobal(t, "document", doc);
  const host = fakeHost({ insideEl: a, inside: [b] });

  renderRegion(host, () => ({ v: 1 }));
  assert.equal(host.swaps, 0, "deferred while #a is focused (precondition)");

  // Tab from #a to #b. The browser parks activeElement on <body> for the
  // duration of focusout and names the incoming element in relatedTarget.
  doc.activeElement = doc.body;
  host.dispatch("focusout", { relatedTarget: b });

  assert.equal(host.swaps, 0, "must NOT rebuild the host out from under the element about to be focused");
  assert.equal(host.listenerCount("focusout"), 1, "stays armed — focus is still held inside the host, so the swap is still owed");
});

test("renderRegion: focusout that hands focus OUTSIDE the host flushes and detaches", (t) => {
  const a = { tagName: "INPUT" };
  const doc = fakeDocument({ activeElement: a });
  patchGlobal(t, "document", doc);
  const host = fakeHost({ insideEl: a });

  renderRegion(host, () => ({ v: 1 }));
  doc.activeElement = doc.body;
  host.dispatch("focusout", { relatedTarget: { tagName: "INPUT" } }); // a control in some OTHER region

  assert.equal(host.swaps, 1, "focus genuinely left the host — the deferred swap lands");
  assert.equal(host.listenerCount("focusout"), 0, "detached once it flushed");
});

test("renderRegion: focusout with no relatedTarget (click onto nothing) flushes", (t) => {
  const a = { tagName: "INPUT" };
  const doc = fakeDocument({ activeElement: a });
  patchGlobal(t, "document", doc);
  const host = fakeHost({ insideEl: a });

  renderRegion(host, () => ({ v: 1 }));
  doc.activeElement = doc.body;
  host.dispatch("focusout", { relatedTarget: null });

  assert.equal(host.swaps, 1, "nothing is receiving focus — nothing to clobber");
});

test("renderRegion: focusout onto a NON-interactive element inside the host still holds (#72)", (t) => {
  // The flush guard is plain CONTAINMENT, deliberately NOT the entry predicate:
  // the entry guard only holds for controls, but a swap must not land on ANY
  // incoming focus inside the host. This is what repairs the dead-button case —
  // mousedown on a button inside a held host fires focusout, and flushing there
  // removes the button before its `click` ever fires.
  const a = { tagName: "INPUT" };
  const btn = { tagName: "BUTTON" }; // _isInteractive(btn) === false
  const doc = fakeDocument({ activeElement: a });
  patchGlobal(t, "document", doc);
  const host = fakeHost({ insideEl: a, inside: [btn] });

  renderRegion(host, () => ({ v: 1 }));
  doc.activeElement = doc.body;
  host.dispatch("focusout", { relatedTarget: btn });

  assert.equal(host.swaps, 0, "the button is about to be focused — do not rebuild it away mid focus-transition");
  assert.equal(host.listenerCount("focusout"), 1, "still armed; it flushes when focus finally leaves the host");
});

test("renderRegion: a swap deferred by an open popover/dialog flushes on 'toggle'", (t) => {
  patchGlobal(t, "document", fakeDocument());
  const overlay = fakeTarget();
  const host = fakeHost({ overlay });

  renderRegion(host, () => ({ id: "panel" }));
  assert.equal(host.swaps, 0, "skipped while the overlay is open");
  assert.equal(overlay.listenerCount("toggle"), 1);
  assert.equal(overlay.listenerCount("close"), 1, "close is also armed (dialog-only; harmless for a popover)");

  host._overlay = null; // the popover/dialog has since closed
  overlay.dispatch("toggle");

  assert.equal(host.swaps, 1, "flushed on toggle");
  assert.deepEqual(host.lastNode, { id: "panel" });
  assert.equal(overlay.listenerCount("toggle"), 0, "detached after flush");
  assert.equal(overlay.listenerCount("close"), 0, "the OTHER armed listener is detached too — shared AbortController");
});

test("renderRegion: a swap deferred by a text selection flushes on selectionchange only once the selection actually clears the host", (t) => {
  const anchor = {};
  const host = fakeHost({ insideEl: anchor }); // host.contains(anchor) === true
  const selection = fakeSelection({ anchorNode: anchor, crosses: [host] });
  const doc = fakeDocument({ selection });
  patchGlobal(t, "document", doc);

  renderRegion(host, () => ({ id: "text" }));
  assert.equal(host.swaps, 0, "skipped while the selection touches host");
  assert.equal(doc.listenerCount("selectionchange"), 1, "one document-level listener armed while pending");

  doc.dispatch("selectionchange"); // selection changed but is STILL inside host
  assert.equal(host.swaps, 0, "must not flush prematurely — selectionInside is re-checked, not assumed clear");
  assert.equal(doc.listenerCount("selectionchange"), 1, "stays armed (not once:true) until it actually clears");

  selection.isCollapsed = true; // the selection has now cleared
  doc.dispatch("selectionchange");

  assert.equal(host.swaps, 1, "flushed once the selection cleared the host");
  assert.equal(doc.listenerCount("selectionchange"), 0, "detached after flushing — never left listening once idle");
});

test("renderRegion: a sig-unchanged skip is a no-op, not a deferral — nothing pending, no listener armed", (t) => {
  patchGlobal(t, "document", fakeDocument());
  const host = fakeHost();
  let builds = 0;

  renderRegion(host, () => { builds++; return {}; }, { sig: "a" }); // first call always swaps
  assert.equal(host.swaps, 1);
  renderRegion(host, () => { builds++; return {}; }, { sig: "a" }); // unchanged sig → skip
  assert.equal(host.swaps, 1, "sig unchanged → no second swap");
  assert.equal(builds, 1, "build() not even called on the sig-gated skip");
  assert.equal(host.listenerCount("focusout"), 0, "a sig-only skip has nothing to flush later — no listener armed");
});

// ── #72: selectionInside asks about the whole range, not its endpoints ────────
//
// Testing only anchorNode/focusNode misses ⌘A over a panel: a range that starts
// before the host and ends after it has NEITHER endpoint inside, so the region
// rebuilt out of the middle of a live selection. Range.intersectsNode is the
// question that actually covers it — and a strict superset of the endpoint test,
// since a boundary point inside the host implies the range intersects it.

test("selectionInside: a range that starts before the host and ends after it holds (#72)", (t) => {
  const before = {}, after = {};
  const host = fakeHost(); // contains neither endpoint
  patchGlobal(t, "document", fakeDocument({
    selection: fakeSelection({ anchorNode: before, focusNode: after, crosses: [host] }),
  }));

  assert.equal(selectionInside(host), true, "the selection spans the host — rebuilding it would destroy the selection mid-copy");
});

test("selectionInside: a selection wholly inside the host still holds — intersectsNode is a superset, not a swap", (t) => {
  const inner = {};
  const host = fakeHost({ insideEl: inner });
  patchGlobal(t, "document", fakeDocument({
    selection: fakeSelection({ anchorNode: inner, crosses: [host] }),
  }));

  assert.equal(selectionInside(host), true);
});

test("selectionInside: a selection that misses the host entirely does not hold, and every range is asked", (t) => {
  const host = fakeHost();
  const other = {};
  patchGlobal(t, "document", fakeDocument({
    selection: fakeSelection({ anchorNode: other, crosses: [other] }),
  }));
  assert.equal(selectionInside(host), false, "a selection elsewhere on the page holds nothing here");

  // Selection exposes a LIST of ranges, so ask all of them rather than assuming
  // one: here the host is crossed by the SECOND, which a first-range-only check
  // would miss.
  patchGlobal(t, "document", fakeDocument({
    selection: {
      isCollapsed: false,
      rangeCount: 2,
      anchorNode: other,
      focusNode: other,
      getRangeAt: (/** @type {number} */ i) => ({ intersectsNode: (/** @type {unknown} */ n) => i === 1 && n === host }),
    },
  }));
  assert.equal(selectionInside(host), true, "every range is asked, not just the first");
});

// ── #72: the hold, exported as a predicate ───────────────────────────────────
//
// A consumer that owns its own retry loop (a polled app whose keyed lists and
// in-place updaters can't replay a captured build) needs the SAME definition of
// "held" renderRegion uses, or it ends up with two hold registries on one host
// that drift apart. heldInside is that definition; renderRegion is wired onto it.

test("heldInside: true for a focused control, an open overlay, and a live selection; false when the host is idle", (t) => {
  const doc = fakeDocument();
  patchGlobal(t, "document", doc);
  const host = fakeHost();
  assert.equal(heldInside(host), false, "idle host holds nothing");

  const input = { tagName: "INPUT" };
  doc.activeElement = input;
  host._insideEl = input;
  assert.equal(heldInside(host), true, "a focused control inside the host");

  doc.activeElement = null;
  host._insideEl = null;
  host._overlay = fakeTarget();
  assert.equal(heldInside(host), true, "an open popover/<dialog> inside the host");

  host._overlay = null;
  const anchor = {};
  host._insideEl = anchor;
  doc.getSelection = () => fakeSelection({ anchorNode: anchor, crosses: [host] });
  assert.equal(heldInside(host), true, "a text selection touching the host");
});

test("heldInside: false for a focused NON-interactive element inside the host — the entry guard holds only for controls", (t) => {
  const btn = { tagName: "BUTTON" };
  patchGlobal(t, "document", fakeDocument({ activeElement: btn }));
  const host = fakeHost({ insideEl: btn });
  assert.equal(heldInside(host), false, "a focused button is not an interaction hold (an indefinite hold there is worse than the clobber)");
});

test("heldInside is the same decision renderRegion makes — a held host is never swapped", (t) => {
  const input = { tagName: "INPUT" };
  patchGlobal(t, "document", fakeDocument({ activeElement: input }));
  const host = fakeHost({ insideEl: input });

  assert.equal(heldInside(host), true);
  renderRegion(host, () => ({ v: 1 }));
  assert.equal(host.swaps, 0, "renderRegion agrees with the predicate — one definition, not two");
});

test("renderRegion returns whether the region was HELD — false on a swap, false on a sig-unchanged skip", (t) => {
  const doc = fakeDocument();
  patchGlobal(t, "document", doc);
  const host = fakeHost();

  assert.equal(renderRegion(host, () => ({ v: 1 }), { sig: "a" }), false, "it swapped");
  // The reason the value is HELD and not SWAPPED: a sig skip is a no-op with
  // nothing to retry, so a consumer's `while (held) retry` loop must terminate.
  assert.equal(renderRegion(host, () => ({ v: 1 }), { sig: "a" }), false, "sig unchanged — a no-op, not a hold");

  const input = { tagName: "INPUT" };
  doc.activeElement = input;
  host._insideEl = input;
  assert.equal(renderRegion(host, () => ({ v: 2 }), { sig: "b" }), true, "held by focus");
  assert.equal(renderRegion(host, () => ({ v: 2 }), { sig: "b", force: true }), false, "force:true never holds");
});

test("renderRegion { defer: false }: reports the hold and arms nothing — the caller owns the retry", (t) => {
  const input = { tagName: "INPUT" };
  const doc = fakeDocument({ activeElement: input });
  patchGlobal(t, "document", doc);
  const host = fakeHost({ insideEl: input });

  let builds = 0;
  assert.equal(renderRegion(host, () => { builds++; return { v: 1 }; }, { sig: "a", defer: false }), true, "held");
  assert.equal(host.swaps, 0);
  assert.equal(builds, 0, "build() still not called on a hold — cheap skip");
  assert.equal(host.listenerCount("focusout"), 0, "no listener armed: canon owns no hold registry under defer:false");

  doc.activeElement = null;
  host.dispatch("focusout", { relatedTarget: null });
  assert.equal(host.swaps, 0, "no stale replay — canon never captured a build to flush");

  // The app's own retry loop calls again with FRESH state. The sig was never
  // recorded on the hold, so the same sig still rebuilds.
  assert.equal(renderRegion(host, () => ({ v: 2 }), { sig: "a", defer: false }), false, "the retry swaps");
  assert.equal(host.swaps, 1);
  assert.deepEqual(host.lastNode, { v: 2 }, "the retry's fresh build lands, not the one that was held");
});

test("renderRegion { defer: false } abandons a self-flush left armed by an earlier defer:true call (#72)", (t) => {
  const input = { tagName: "INPUT" };
  const doc = fakeDocument({ activeElement: input });
  patchGlobal(t, "document", doc);
  const host = fakeHost({ insideEl: input });

  renderRegion(host, () => ({ v: "frozen" })); // a legacy call arms a listener and captures THIS build
  assert.equal(host.listenerCount("focusout"), 1, "precondition: canon is holding its own pending swap");

  assert.equal(renderRegion(host, () => ({ v: "fresh" }), { defer: false }), true, "still held");
  assert.equal(host.listenerCount("focusout"), 0, "canon's registry is dropped — two holds on one host can't diverge");

  doc.activeElement = null;
  host.dispatch("focusout", { relatedTarget: null });
  assert.equal(host.swaps, 0, "the frozen build can never flush in behind the caller's own retry");
});

test("markRegionStale: the next call rebuilds despite an unchanged sig — through the guards, not around them", (t) => {
  const doc = fakeDocument();
  patchGlobal(t, "document", doc);
  const host = fakeHost();

  renderRegion(host, () => ({ v: 1 }), { sig: "a" });
  assert.equal(host.swaps, 1);
  renderRegion(host, () => ({ v: 2 }), { sig: "a" });
  assert.equal(host.swaps, 1, "unchanged sig skips (precondition)");

  markRegionStale(host);
  // A control is focused when the next tick arrives — staleness must not
  // bypass the interaction guards (that would be force:true by another name).
  const input = { tagName: "INPUT" };
  doc.activeElement = input;
  host._insideEl = input;
  renderRegion(host, () => ({ v: 2 }), { sig: "a" });
  assert.equal(host.swaps, 1, "stale rebuild still defers while a control inside host is focused");

  doc.activeElement = null;
  host.dispatch("focusout", { relatedTarget: null });
  assert.equal(host.swaps, 2, "stale-marked region rebuilt despite the unchanged sig");
  assert.deepEqual(host.lastNode, { v: 2 });
});

test("renderRegion: an overlay removed WITHOUT close/toggle flushes via the removal observer", (t) => {
  patchGlobal(t, "document", fakeDocument());
  const overlay = /** @type {any} */ ({ ...fakeTarget(), isConnected: true });
  const host = fakeHost({ overlay });
  /** @type {any[]} */ const observers = [];
  class FakeMO {
    /** @param {() => void} cb */
    constructor(cb) { this.cb = cb; this.disconnected = false; observers.push(this); }
    /** @param {unknown} target @param {unknown} opts */
    observe(target, opts) { this.target = target; this.opts = opts; }
    disconnect() { this.disconnected = true; }
  }
  patchGlobal(t, "MutationObserver", FakeMO);

  renderRegion(host, () => ({ id: "after-removal" }));
  assert.equal(host.swaps, 0, "skipped while the overlay is open");
  assert.equal(observers.length, 1, "a removal observer is armed alongside toggle/close");
  assert.equal(observers[0].target, host, "observes the host subtree");
  assert.deepEqual(observers[0].opts, { childList: true, subtree: true });

  observers[0].cb(); // some unrelated mutation — overlay still connected
  assert.equal(host.swaps, 0, "still open and connected — no flush");

  overlay.isConnected = false; // dialog.remove() / parent re-render — no close/toggle fires
  host._overlay = null;
  observers[0].cb();
  assert.equal(host.swaps, 1, "flushed when the overlay left the DOM without an event");
  assert.deepEqual(host.lastNode, { id: "after-removal" });
  assert.equal(observers[0].disconnected, true, "observer disconnected by the pending controller's abort");
  assert.equal(overlay.listenerCount("toggle"), 0, "the event listeners are detached by the same abort");
});

test("renderRegion: a detached host drops its pending swap — cleared, never rendered", (t) => {
  const input = { tagName: "INPUT" };
  const doc = fakeDocument({ activeElement: input });
  patchGlobal(t, "document", doc);
  const host = fakeHost({ insideEl: input });

  renderRegion(host, () => ({ v: "stale" }));
  assert.equal(host.listenerCount("focusout"), 1, "deferred by focus");

  host.isConnected = false; // the host itself was removed (view unmount / parent re-render)
  doc.activeElement = null;
  host.dispatch("focusout", { relatedTarget: null });

  assert.equal(host.swaps, 0, "no render into a detached host");
  assert.equal(host.listenerCount("focusout"), 0, "listener detached — controller aborted");
  host.dispatch("focusout", { relatedTarget: null });
  assert.equal(host.swaps, 0, "pending entry cleared — nothing left to flush");
});

test("renderRegion: a later direct swap clears any earlier pending flush for the same host", (t) => {
  const input = { tagName: "INPUT" };
  const doc = fakeDocument({ activeElement: input });
  patchGlobal(t, "document", doc);
  const host = fakeHost({ insideEl: input });

  renderRegion(host, () => ({ v: "stale" })); // deferred by focus
  assert.equal(host.listenerCount("focusout"), 1);

  renderRegion(host, () => ({ v: "fresh" }), { force: true }); // e.g. a user action forces a swap now
  assert.equal(host.swaps, 1);
  assert.deepEqual(host.lastNode, { v: "fresh" });
  assert.equal(host.listenerCount("focusout"), 0, "the earlier pending flush (and its listener) is cleared by the direct swap");

  doc.activeElement = null;
  host.dispatch("focusout", { relatedTarget: null }); // nothing armed — must be a no-op
  assert.equal(host.swaps, 1, "no extra swap fires — the stale pending build never runs");
});
