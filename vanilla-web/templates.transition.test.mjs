// Functional guard for withTransition — the View Transition trigger.
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
import { withTransition, renderRegion } from "./templates.js";
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

/** @param {{ insideEl?: unknown, overlay?: any }} [opts] */
function fakeHost({ insideEl = null, overlay = null } = {}) {
  const target = fakeTarget();
  const host = /** @type {any} */ ({
    ...target,
    tagName: "DIV",
    isConnected: true, // real Elements always carry this; the detached-host test flips it
    _insideEl: insideEl,
    _overlay: overlay,
    contains(/** @type {unknown} */ node) { return node === host._insideEl; },
    querySelector() { return host._overlay; },
    swaps: 0,
    lastNode: /** @type {unknown} */ (null),
    replaceChildren(/** @type {unknown} */ node) { host.swaps++; host.lastNode = node; },
  });
  return host;
}

/** @param {{ activeElement?: unknown, selection?: any }} [opts] */
function fakeDocument({ activeElement = null, selection = null } = {}) {
  const target = fakeTarget();
  return { ...target, activeElement, getSelection: () => selection };
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
  host.dispatch("focusout");

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
  host.dispatch("focusout");
  assert.equal(host.swaps, 1);
  assert.deepEqual(host.lastNode, { v: 3 }, "the LATEST skipped build wins; the two intermediate ones are dropped");
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
  const selection = { isCollapsed: false, rangeCount: 1, anchorNode: anchor, focusNode: anchor };
  const doc = fakeDocument({ selection });
  patchGlobal(t, "document", doc);
  const host = fakeHost({ insideEl: anchor }); // host.contains(anchor) === true

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
  host.dispatch("focusout");

  assert.equal(host.swaps, 0, "no render into a detached host");
  assert.equal(host.listenerCount("focusout"), 0, "listener detached — controller aborted");
  host.dispatch("focusout");
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
  host.dispatch("focusout"); // nothing armed — must be a no-op
  assert.equal(host.swaps, 1, "no extra swap fires — the stale pending build never runs");
});
