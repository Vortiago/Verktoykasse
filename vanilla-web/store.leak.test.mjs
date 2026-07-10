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
import { patchGlobal, makeFlush, fakeEventTarget } from "./testing-util.mjs";

/** A store whose load never has to run for these synchronous-notify tests. */
const newStore = () => createStore(async () => null);

/** Resolve the microtasks createStore's load-chain (Promise.resolve().then(load)…) queues. */
const flush = makeFlush(8);

/** Install fake document/window on globalThis for one test (#46's refetchOn
 * listeners are gated on `typeof document/window !== "undefined"`, so plain
 * node — no globals stubbed — exercises the "no browser" no-op path; every
 * OTHER test in this file relies on exactly that for its default-unchanged
 * assertion). Each fake is a fakeEventTarget, same double the live.leak.test.mjs
 * / templates.transition.test.mjs fakes share. */
function installFakeBrowserGlobals(t, { visibilityState = "visible" } = {}) {
  const doc = { visibilityState, ...fakeEventTarget() };
  const win = fakeEventTarget();
  patchGlobal(t, "document", doc);
  patchGlobal(t, "window", win);
  return { doc, win };
}

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

// ── #46: opt-in freshness (refetchOn) ────────────────────────────────────────

test("no options: createStore never touches document/window — the default-unchanged contract", () => {
  // No fake document/window installed for THIS test — if createStore ever
  // touched them unconditionally (regardless of refetchOn), this would throw.
  assert.doesNotThrow(() => createStore(async () => null));
});

test("refetchOn: ['visible'] refreshes on visibilitychange→visible only once the value is older than maxAge", async (t) => {
  const { doc } = installFakeBrowserGlobals(t, { visibilityState: "hidden" });
  let loads = 0;
  const store = createStore(async () => ++loads, { refetchOn: ["visible"], maxAge: 1000 });
  await store.load();
  assert.equal(loads, 1, "primed once");

  doc.visibilityState = "visible";
  doc.dispatch("visibilitychange");
  await flush();
  assert.equal(loads, 1, "still fresh — no refetch");

  // Simulate the value aging past maxAge without a real 1s wait.
  const realNow = Date.now;
  Date.now = () => realNow() + 2000;
  try {
    doc.dispatch("visibilitychange");
    await flush();
  } finally { Date.now = realNow; }
  assert.equal(loads, 2, "stale past maxAge — refetches on visible");
});

test("refetchOn: ['visible'] with no maxAge always refetches on visible", async (t) => {
  const { doc } = installFakeBrowserGlobals(t, { visibilityState: "hidden" });
  let loads = 0;
  const store = createStore(async () => ++loads, { refetchOn: ["visible"] });
  await store.load();
  assert.equal(loads, 1);

  doc.visibilityState = "visible";
  doc.dispatch("visibilitychange");
  await flush();
  assert.equal(loads, 2, "no maxAge → every visible refetches, even immediately");
});

test("refetchOn: ['visible'] ignores visibilitychange while hidden", async (t) => {
  const { doc } = installFakeBrowserGlobals(t, { visibilityState: "hidden" });
  let loads = 0;
  const store = createStore(async () => ++loads, { refetchOn: ["visible"] });
  await store.load();

  doc.dispatch("visibilitychange"); // visibilityState is still "hidden"
  await flush();
  assert.equal(loads, 1, "a hidden→hidden (or tab-close) event must not refetch");
});

test("refetchOn: ['online'] refreshes unconditionally on window 'online'", async (t) => {
  const { win } = installFakeBrowserGlobals(t);
  let loads = 0;
  const store = createStore(async () => ++loads, { refetchOn: ["online"] });
  await store.load();
  assert.equal(loads, 1);

  win.dispatch("online");
  await flush();
  assert.equal(loads, 2, "online refetches regardless of maxAge (none was even passed)");
});

// ── refetch races: generation guard + in-flight skip ─────────────────────────

test("a superseded load resolving late neither clobbers the value nor notifies", async () => {
  /** @type {Array<(v: unknown) => void>} */ const resolvers = [];
  const store = createStore(() => new Promise((res) => resolvers.push(res)));
  /** @type {unknown[]} */ const seen = [];
  store.subscribe((v) => seen.push(v));

  const first = store.load();  // chain 1 — resolves LAST (the stale response)
  await flush();               // let chain 1 reach its load() call
  store.refresh();             // chain 2 supersedes chain 1 mid-flight
  await flush();
  assert.equal(resolvers.length, 2, "both chains have called load()");

  resolvers[1]("fresh");       // the newer chain settles first
  await flush();
  assert.equal(store.get(), "fresh");
  assert.deepEqual(seen, ["fresh"]);

  resolvers[0]("stale");       // the superseded chain settles late
  await first;
  await flush();
  assert.equal(store.get(), "fresh", "a late stale response must not clobber the newer value");
  assert.deepEqual(seen, ["fresh"], "and must not notify — nothing changed");
});

test("refetchOn: an event during an in-flight load does not start a second load", async (t) => {
  const { doc, win } = installFakeBrowserGlobals(t, { visibilityState: "visible" });
  let loads = 0;
  /** @type {(v: unknown) => void} */ let release = () => {};
  const store = createStore(() => { loads++; return new Promise((res) => { release = res; }); },
    { refetchOn: ["visible", "online"] });

  const p = store.load();
  await flush();
  assert.equal(loads, 1, "initial load in flight");

  doc.dispatch("visibilitychange");
  win.dispatch("online");
  await flush();
  assert.equal(loads, 1, "freshness already in flight — neither listener double-loads");

  release(1);
  await p;
  await flush();
  win.dispatch("online"); // settled again → events refetch as normal
  await flush();
  assert.equal(loads, 2, "after the load settles, refetchOn works again");
});

test("refetchOn: an aborted signal releases both listeners — no leaked module-level registration", async (t) => {
  const { doc, win } = installFakeBrowserGlobals(t, { visibilityState: "visible" });
  const controller = new AbortController();
  let loads = 0;
  const store = createStore(async () => ++loads, { refetchOn: ["visible", "online"], signal: controller.signal });
  await store.load();
  assert.equal(loads, 1);

  controller.abort();
  doc.dispatch("visibilitychange");
  win.dispatch("online");
  await flush();
  assert.equal(loads, 1, "both listeners drained by the signal — neither event refetches after abort");
});
