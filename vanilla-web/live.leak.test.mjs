// Memory-leak guards for live.js — the live-data teardown contract.
//
// These are the helpers behind "how the UI retrieves data / updates": a long-
// lived SSE connection (liveSSE) and a polling loop (livePoll). Both must release
// everything they open when the view's mount signal aborts — an EventSource left
// open or an interval left ticking keeps its callback (and the view DOM that
// callback rebuilds) alive for the life of the tab. Over repeated view switches
// that is the unbounded growth that ends in an out-of-memory crash.
//
// No real network or DOM: EventSource/fetch are faked on globalThis (Node 22
// ships real ones, so the prior value is captured and restored), timers are
// node:test fakes, and AbortController is native.
import { test } from "node:test";
import assert from "node:assert/strict";
import { liveSSE, livePoll } from "./live.js";

/** Resolve the microtasks an awaited fetch chain queues after a synchronous tick. */
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

/** Install a value on globalThis for one test, restoring the prior value after. */
function patchGlobal(t, name, value) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, name);
  const prev = globalThis[name];
  globalThis[name] = value;
  t.after(() => { if (had) globalThis[name] = prev; else delete globalThis[name]; });
}

// ── liveSSE ─────────────────────────────────────────────────────────────────

/** Minimal EventSource double: records instances, url, closed flag; _emit drives onmessage. */
function installFakeEventSource(t) {
  const instances = [];
  class FakeEventSource {
    constructor(url) {
      this.url = url;
      this.closed = false;
      this.onmessage = null;
      instances.push(this);
    }
    close() { this.closed = true; }
    _emit(data) { this.onmessage?.({ data }); }
  }
  patchGlobal(t, "EventSource", FakeEventSource);
  return instances;
}

test("liveSSE opens exactly one EventSource to the url and routes parsed messages to onData", (t) => {
  const instances = installFakeEventSource(t);
  const seen = [];
  const controller = new AbortController();

  liveSSE("/api/events", (data, raw) => seen.push([data, raw]), controller.signal);

  assert.equal(instances.length, 1, "one EventSource opened");
  assert.equal(instances[0].url, "/api/events");

  instances[0]._emit('{"a":1}');
  assert.deepEqual(seen, [[{ a: 1 }, '{"a":1}']], "parsed JSON + raw string handed to onData");
});

test("liveSSE swallows a malformed message instead of letting it throw out of onmessage", (t) => {
  const instances = installFakeEventSource(t);
  const seen = [];
  const controller = new AbortController();

  liveSSE("/api/events", (d) => seen.push(d), controller.signal);
  assert.doesNotThrow(() => instances[0]._emit("not json{"));
  assert.deepEqual(seen, [], "onData not called for malformed payload");
});

test("liveSSE closes the EventSource when the signal aborts (the leak guard)", (t) => {
  const instances = installFakeEventSource(t);
  const controller = new AbortController();

  liveSSE("/api/events", () => {}, controller.signal);
  assert.equal(instances[0].closed, false, "open while the signal is live");

  controller.abort();
  assert.equal(instances[0].closed, true, "closed on abort");
});

test("liveSSE registers its abort listener with { once: true }", (t) => {
  installFakeEventSource(t);
  const controller = new AbortController();
  t.mock.method(controller.signal, "addEventListener");

  liveSSE("/api/events", () => {}, controller.signal);

  const abortCalls = controller.signal.addEventListener.mock.calls
    .filter((c) => c.arguments[0] === "abort");
  assert.equal(abortCalls.length, 1, "one abort listener");
  assert.deepEqual(abortCalls[0].arguments[2], { once: true });
});

// ── livePoll ────────────────────────────────────────────────────────────────

/** A fetch double whose body is mutable between ticks; records call count. */
function installFakeFetch(t, ref) {
  const fetch = t.mock.fn(async () => ({ text: async () => ref.body }));
  patchGlobal(t, "fetch", fetch);
  return fetch;
}

test("livePoll primes immediately and fires onData once with the parsed body", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const ref = { body: '{"n":1}' };
  const fetch = installFakeFetch(t, ref);
  const seen = [];
  const controller = new AbortController();

  livePoll("/api/data", (d) => seen.push(d), controller.signal, 1000);
  await flush();

  assert.equal(fetch.mock.callCount(), 1, "primed once");
  assert.deepEqual(seen, [{ n: 1 }], "parsed body delivered");
});

test("livePoll de-dupes: an unchanged response does not fire onData again, a changed one does", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const ref = { body: '{"n":1}' };
  installFakeFetch(t, ref);
  const seen = [];
  const controller = new AbortController();

  livePoll("/api/data", (d) => seen.push(d), controller.signal, 1000);
  await flush();                       // prime → fires
  t.mock.timers.tick(1000); await flush(); // same body → no fire
  assert.deepEqual(seen, [{ n: 1 }], "no duplicate onData for an unchanged body");

  ref.body = '{"n":2}';
  t.mock.timers.tick(1000); await flush(); // changed body → fires
  assert.deepEqual(seen, [{ n: 1 }, { n: 2 }], "changed body delivered");
});

test("livePoll stops fetching after the signal aborts (the leak guard)", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const ref = { body: '{"n":1}' };
  const fetch = installFakeFetch(t, ref);
  const controller = new AbortController();

  livePoll("/api/data", () => {}, controller.signal, 1000);
  await flush();
  t.mock.timers.tick(1000); await flush();
  const before = fetch.mock.callCount();
  assert.ok(before >= 2, "polling while live");

  controller.abort();
  t.mock.timers.tick(10_000); await flush(); // ten intervals would fetch if it leaked
  assert.equal(fetch.mock.callCount(), before, "fetch count frozen after abort");
});
