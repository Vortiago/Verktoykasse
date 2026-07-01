// Memory-leak guards for store.js — the subscriber-Set teardown contract.
//
// The HIGH-risk leak (see reference/testing.md "Memory leaks"): a view that
// subscribes on mount but never releases the subscription leaves its callback —
// and the detached DOM that callback closes over — pinned in `subs` forever, so
// the Set grows one entry per mount/unmount cycle until the tab runs out of heap.
//
// The Set is private, so the observable proxy for "is this callback still in the
// Set" is "does a single synchronous set() still fan out to it". A drained Set
// fans out to zero. These tests assert release through BOTH paths: the manual
// unsubscribe() return value, and the new signal overload that auto-releases on
// abort (the contract every other helper already honours).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "./store.js";

/** A store whose load never has to run for these synchronous-notify tests. */
const newStore = () => createStore(async () => null);

test("manual unsubscribe() drains the callback — a post-unsubscribe set() does not fan out to it", () => {
  const store = newStore();
  // Simulate N mount/unmount cycles: each subscribes then unsubscribes.
  const calls = [];
  for (let i = 0; i < 5; i++) {
    const off = store.subscribe(() => calls.push(i));
    off(); // unmount
  }
  store.set("v"); // a later notify must reach none of the 5 cycled callbacks
  assert.deepEqual(calls, [], "every cycled callback should have been drained from subs");
});

test("subscribe() fan-out: live subscribers each fire once with the new value; an unsubscribed one stops", () => {
  const store = newStore();
  const a = [];
  const b = [];
  const offA = store.subscribe((v) => a.push(v));
  store.subscribe((v) => b.push(v));

  store.set("first");
  assert.deepEqual(a, ["first"]);
  assert.deepEqual(b, ["first"]);

  offA(); // A unsubscribes; B stays
  store.set("second");
  assert.deepEqual(a, ["first"], "A must not fire after unsubscribe");
  assert.deepEqual(b, ["first", "second"], "B keeps receiving");
});

test("unsubscribe() is idempotent and isolated — calling it twice neither throws nor disturbs other subscribers", () => {
  const store = newStore();
  const other = [];
  const off = store.subscribe(() => {});
  store.subscribe((v) => other.push(v));

  off();
  assert.doesNotThrow(off, "second unsubscribe must be a safe no-op");

  store.set("v");
  assert.deepEqual(other, ["v"], "the surviving subscriber is unaffected");
});

test("signal overload: aborting the signal drains the subscription — set() after abort does not fan out", () => {
  const store = newStore();
  const controller = new AbortController();
  const calls = [];

  store.subscribe((v) => calls.push(v), controller.signal);

  store.set("before"); // live: should fire
  assert.deepEqual(calls, ["before"], "subscriber fires while the signal is live");

  controller.abort(); // unmount via the view's AbortSignal
  store.set("after"); // drained: must NOT fire
  assert.deepEqual(calls, ["before"], "aborting the signal must release the subscriber");
});

test("signal overload: an already-aborted signal still returns a usable, idempotent unsubscribe", () => {
  const store = newStore();
  const controller = new AbortController();
  controller.abort();
  const calls = [];

  const off = store.subscribe((v) => calls.push(v), controller.signal);
  assert.equal(typeof off, "function", "subscribe always returns an unsubscribe function");
  assert.doesNotThrow(off, "unsubscribe is safe even when the signal pre-aborted");

  store.set("v");
  assert.deepEqual(calls, [], "a pre-aborted signal must not leave the subscriber live");
});
