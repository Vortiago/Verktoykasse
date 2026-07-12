// Memory-leak guards for lazy.js — the observer teardown contract.
//
// whenSized (ResizeObserver) and onceVisible (IntersectionObserver) each watch
// an element and must, on EVERY exit path (resolved, fired, or aborted),
// (a) disconnect the observer and (b) detach the abort listener they added to
// the signal. A live observer pins its target subtree; an undetached abort
// listener accumulates one-per-call on a long-lived signal. The gauge for (b) is
// add/remove PARITY: the same number of 'abort' listeners added were removed.
//
// DOM-free: the helpers only READ element properties and hand the opaque element
// to the observer global, so a plain mutable object stands in for the element and
// the observers are faked on globalThis (Node has neither natively).
import { test } from "node:test";
import assert from "node:assert/strict";
import { whenSized, onceVisible } from "./lazy.js";

// Mirrors vanilla-web/testing-util.mjs's patchGlobal — defineProperty (not
// plain assignment), since some real globals are getter-only accessors that a
// bare `globalThis.x = …` throws on. No cross-skill imports, so this is a
// deliberate local copy rather than a shared dependency.
function patchGlobal(t, name, value) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, name);
  const prevDescriptor = had ? Object.getOwnPropertyDescriptor(globalThis, name) : undefined;
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true, enumerable: true });
  t.after(() => {
    if (prevDescriptor) Object.defineProperty(globalThis, name, prevDescriptor);
    else delete globalThis[name];
  });
}

/** Observer double: records instances + observed target, exposes a disconnected
 * flag and a _fire(entries) to drive the callback. Works for both observer APIs. */
function installFakeObserver(t, name) {
  const instances = [];
  class FakeObserver {
    constructor(cb) { this.cb = cb; this.disconnected = false; this.target = null; instances.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
    _fire(entries) { this.cb(entries); }
  }
  patchGlobal(t, name, FakeObserver);
  return instances;
}

/** Spy add/removeEventListener on a signal; returns a parity checker for 'abort'. */
function watchAbortListeners(t, signal) {
  t.mock.method(signal, "addEventListener");
  t.mock.method(signal, "removeEventListener");
  const count = (m) => signal[m].mock.calls.filter((c) => c.arguments[0] === "abort").length;
  return {
    added: () => count("addEventListener"),
    removed: () => count("removeEventListener"),
    assertParity: () => assert.equal(count("addEventListener"), count("removeEventListener"),
      "every 'abort' listener added must be removed"),
  };
}

const sizedEl = () => ({ isConnected: true, clientWidth: 10, clientHeight: 10 });
const unsizedEl = () => ({ isConnected: true, clientWidth: 0, clientHeight: 0 });

// ── whenSized (ResizeObserver) ────────────────────────────────────────────────

test("whenSized resolves immediately for an already-sized element without constructing an observer", async (t) => {
  const instances = installFakeObserver(t, "ResizeObserver");
  await whenSized(sizedEl(), new AbortController().signal);
  assert.equal(instances.length, 0, "no ResizeObserver created when already sized");
});

test("whenSized disconnects the observer and detaches the abort listener once the element becomes sized", async (t) => {
  const instances = installFakeObserver(t, "ResizeObserver");
  const controller = new AbortController();
  const abort = watchAbortListeners(t, controller.signal);
  const el = unsizedEl();

  const pending = whenSized(el, controller.signal);
  assert.equal(instances.length, 1, "observer created while unsized");
  assert.equal(abort.added(), 1, "abort listener attached while pending");

  el.clientWidth = 20; el.clientHeight = 20; // it gets laid out
  instances[0]._fire([{}]);                  // ResizeObserver notifies
  await pending;

  assert.equal(instances[0].disconnected, true, "observer disconnected on success");
  abort.assertParity();
});

test("whenSized disconnects the observer and detaches the abort listener when the signal aborts first", async (t) => {
  const instances = installFakeObserver(t, "ResizeObserver");
  const controller = new AbortController();
  const abort = watchAbortListeners(t, controller.signal);

  const pending = whenSized(unsizedEl(), controller.signal);
  assert.equal(instances.length, 1);

  controller.abort();
  await pending; // never rejects; abort resolves it too

  assert.equal(instances[0].disconnected, true, "observer disconnected on abort");
  abort.assertParity();
});

test("whenSized resolves (no hang) when ResizeObserver is unavailable", async (t) => {
  // ResizeObserver intentionally NOT installed → typeof === 'undefined' branch.
  await whenSized(unsizedEl(), new AbortController().signal);
  assert.ok(true, "resolved without an observer API");
});

// ── onceVisible (IntersectionObserver) ────────────────────────────────────────

test("onceVisible fires cb once, then disconnects and detaches the abort listener on intersection", async (t) => {
  const instances = installFakeObserver(t, "IntersectionObserver");
  const controller = new AbortController();
  const abort = watchAbortListeners(t, controller.signal);
  const cb = t.mock.fn();

  onceVisible(sizedEl(), cb, controller.signal);
  assert.equal(instances.length, 1);
  assert.equal(abort.added(), 1);

  instances[0]._fire([{ isIntersecting: true }]);

  assert.equal(cb.mock.callCount(), 1, "cb fired once on intersection");
  assert.equal(instances[0].disconnected, true, "observer disconnected after firing");
  abort.assertParity();
});

test("onceVisible never fires cb but still disconnects + detaches when aborted before intersection", (t) => {
  const instances = installFakeObserver(t, "IntersectionObserver");
  const controller = new AbortController();
  const abort = watchAbortListeners(t, controller.signal);
  const cb = t.mock.fn();

  onceVisible(unsizedEl(), cb, controller.signal);
  controller.abort();

  assert.equal(cb.mock.callCount(), 0, "cb not fired on abort");
  assert.equal(instances[0].disconnected, true, "observer disconnected on abort");
  abort.assertParity();
});

test("onceVisible with a pre-aborted signal does nothing — no observer, no cb", (t) => {
  const instances = installFakeObserver(t, "IntersectionObserver");
  const controller = new AbortController();
  controller.abort();
  const cb = t.mock.fn();

  onceVisible(unsizedEl(), cb, controller.signal);

  assert.equal(instances.length, 0, "no observer constructed for a pre-aborted signal");
  assert.equal(cb.mock.callCount(), 0);
});

test("onceVisible ignores a non-intersecting entry — cb stays unfired, observer stays connected", (t) => {
  const instances = installFakeObserver(t, "IntersectionObserver");
  const cb = t.mock.fn();

  onceVisible(unsizedEl(), cb, new AbortController().signal);
  instances[0]._fire([{ isIntersecting: false }]);

  assert.equal(cb.mock.callCount(), 0, "no cb until something intersects");
  assert.equal(instances[0].disconnected, false, "observer keeps watching");
});

test("onceVisible fires cb immediately when IntersectionObserver is unavailable", (t) => {
  // IntersectionObserver intentionally NOT installed.
  const cb = t.mock.fn();
  onceVisible(sizedEl(), cb, new AbortController().signal);
  assert.equal(cb.mock.callCount(), 1, "degrades to firing immediately");
});
