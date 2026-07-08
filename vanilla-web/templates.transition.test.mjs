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
import { withTransition } from "./templates.js";

/** Run `body` with a stubbed `globalThis.document`, restored afterwards; returns
 * whatever `body` returns. @param {any} doc @param {() => any} body */
function withDocument(doc, body) {
  const g = /** @type {any} */ (globalThis);
  const had = "document" in g;
  const prev = g.document;
  g.document = doc;
  try { return body(); }
  finally { if (had) g.document = prev; else delete g.document; }
}

/** @param {any} ret */
const isThenableFinished = (ret) => ret != null && typeof ret.finished?.then === "function";

test("routes the mutation through startViewTransition and returns its transition", () => {
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
  const ret = withDocument(doc, () => withTransition(() => { calls.updated++; }));
  assert.equal(calls.started, 1, "startViewTransition called once");
  assert.equal(calls.updated, 1, "the update ran (inside the transition)");
  assert.equal(ret, transition, "returns the ViewTransition so .finished composes");
});

test("falls back to a synchronous update when startViewTransition is missing", () => {
  let updated = 0;
  const ret = withDocument({}, () => withTransition(() => { updated++; }));
  assert.equal(updated, 1, "update ran directly with no transition available");
  assert.ok(isThenableFinished(ret), "fallback still returns a { finished } shim so callers can .finished uniformly");
});

test("falls back when startViewTransition is present but not callable", () => {
  let updated = 0;
  // A partial/older impl might expose the name as a non-function — must still fall back,
  // never skip the mutation (which would silently drop the user's change).
  const ret = withDocument({ startViewTransition: null }, () => withTransition(() => { updated++; }));
  assert.equal(updated, 1, "non-callable startViewTransition falls back to a direct update");
  assert.ok(isThenableFinished(ret), "fallback returns the shim here too");
});
