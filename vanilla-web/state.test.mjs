// Behaviour + leak guards for state.js — createState's batching contract and
// the subscribe/signal teardown it shares with store.js (see store.leak.test.mjs).
//
// The load-bearing assertion is batching: N synchronous writes in one handler
// must fan out to exactly ONE render per subscriber, not N — queueMicrotask
// coalesces same-tick writes, so the test awaits a microtask, not a write.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createState } from "./state.js";

/** Resolve the microtask queueMicrotask's notify sits behind. */
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

test("get() returns the initial value, then the latest set() value", () => {
  const s = createState({ n: 0 });
  assert.deepEqual(s.get(), { n: 0 });
  s.set({ n: 1 });
  assert.deepEqual(s.get(), { n: 1 }, "get() is synchronous — no need to await notify to read the new value");
});

test("update() applies a functional patch over the current value", () => {
  const s = createState({ n: 1 });
  s.update((v) => ({ n: v.n + 1 }));
  assert.deepEqual(s.get(), { n: 2 });
});

test("batching: three synchronous writes in one handler notify each subscriber exactly once", async () => {
  const s = createState({ n: 0 });
  const calls = [];
  s.subscribe((v) => calls.push(v));

  // Simulate one event handler doing three writes — the case #47 exists for.
  s.set({ n: 1 });
  s.update((v) => ({ n: v.n + 1 }));
  s.update((v) => ({ n: v.n + 1 }));
  assert.deepEqual(calls, [], "no notify yet — still the same synchronous tick");

  await flush();
  assert.deepEqual(calls, [{ n: 3 }], "exactly one notification, with the FINAL value — not three");
});

test("two separate microtask turns produce two separate notifications", async () => {
  const s = createState(0);
  const calls = [];
  s.subscribe((v) => calls.push(v));

  s.set(1);
  await flush();
  s.set(2);
  await flush();

  assert.deepEqual(calls, [1, 2], "writes in DIFFERENT ticks are not coalesced together");
});

test("multiple subscribers each receive the batched notification once", async () => {
  const s = createState(0);
  const a = [];
  const b = [];
  s.subscribe((v) => a.push(v));
  s.subscribe((v) => b.push(v));

  s.set(1);
  s.set(2);
  await flush();

  assert.deepEqual(a, [2]);
  assert.deepEqual(b, [2]);
});

test("manual unsubscribe() drains the callback — a later write does not fan out to it", async () => {
  const s = createState(0);
  const calls = [];
  const off = s.subscribe((v) => calls.push(v));
  off();

  s.set(1);
  await flush();
  assert.deepEqual(calls, [], "unsubscribed before any write — must never fire");
});

test("signal overload: aborting the signal drains the subscription — a later write does not fan out", async () => {
  const s = createState(0);
  const controller = new AbortController();
  const calls = [];
  s.subscribe((v) => calls.push(v), controller.signal);

  s.set(1);
  await flush();
  assert.deepEqual(calls, [1], "live while the signal hasn't aborted");

  controller.abort();
  s.set(2);
  await flush();
  assert.deepEqual(calls, [1], "aborting the signal must release the subscriber");
});

test("signal overload: an already-aborted signal still returns a usable, idempotent unsubscribe", async () => {
  const s = createState(0);
  const controller = new AbortController();
  controller.abort();
  const calls = [];

  const off = s.subscribe((v) => calls.push(v), controller.signal);
  assert.equal(typeof off, "function");
  assert.doesNotThrow(off);

  s.set(1);
  await flush();
  assert.deepEqual(calls, [], "a pre-aborted signal must not leave the subscriber live");
});
