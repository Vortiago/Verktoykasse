// Abort-semantics guards for templates.js (#61 / #62):
//   - loadTemplates(...urls, {signal}) passes the signal through to fetch, and
//     an aborted/failed fetch must NOT poison the module-level `fetched` set —
//     a later call for the same url must retry, not silently no-op.
//   - wireErrorBar filters AbortError at both the error and unhandledrejection
//     hooks (console.debug instead of painting the errbar), and never beacons
//     one to /api/client-errors.
//
// No jsdom: document/fetch/navigator are faked on globalThis per test, same
// pattern as the other *.test.mjs files in this package.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTemplates, wireErrorBar } from "./templates.js";
import { patchGlobal } from "./testing-util.mjs";

/** A minimal fake `document` sufficient for loadTemplates: createElement()
 * returns one reusable holder (children irrelevant to these tests — they only
 * observe fetch call counts, not the resulting DOM), body.append is a no-op. */
function installFakeDom(t) {
  const holder = { hidden: false, innerHTML: "", children: [] };
  patchGlobal(t, "document", {
    createElement: () => holder,
    body: { append: () => {} },
  });
}

// ── loadTemplates: abort must not poison the `fetched` set ───────────────────

test("loadTemplates: an aborted fetch does NOT mark the url fetched — a later call retries it cleanly", async (t) => {
  installFakeDom(t);
  const url = "/abort-retry-1.html"; // unique per test — `fetched` is module-level and persists across tests
  let calls = 0;
  patchGlobal(t, "fetch", async () => {
    calls++;
    if (calls === 1) throw new DOMException("aborted", "AbortError");
    return { ok: true, text: async () => "" };
  });

  await assert.rejects(() => loadTemplates(url, { signal: new AbortController().signal }));
  assert.equal(calls, 1, "first (aborted) attempt");

  await loadTemplates(url); // must NOT be skipped as "already fetched"
  assert.equal(calls, 2, "second call re-fetched — the aborted attempt did not poison the fetched set");
});

test("loadTemplates: a failed (non-ok) fetch also does not mark the url fetched", async (t) => {
  installFakeDom(t);
  const url = "/abort-retry-2.html";
  let calls = 0;
  patchGlobal(t, "fetch", async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, text: async () => "" };
  });

  await assert.rejects(() => loadTemplates(url));
  assert.equal(calls, 1);
  await loadTemplates(url);
  assert.equal(calls, 2, "retries after a failed fetch too, not just an aborted one");
});

test("loadTemplates: a successful fetch IS memoized — a repeat call for the same url does not re-fetch", async (t) => {
  installFakeDom(t);
  const url = "/memo-once.html";
  let calls = 0;
  patchGlobal(t, "fetch", async () => { calls++; return { ok: true, text: async () => "" }; });

  await loadTemplates(url);
  await loadTemplates(url);
  assert.equal(calls, 1, "idempotent: fetched once, second call is a no-op");
});

test("loadTemplates: passes the trailing options object's signal through to fetch", async (t) => {
  installFakeDom(t);
  const url = "/signal-passthrough.html";
  /** @type {AbortSignal | undefined} */
  let seenSignal;
  patchGlobal(t, "fetch", async (_url, opts) => { seenSignal = opts?.signal; return { ok: true, text: async () => "" }; });

  const controller = new AbortController();
  await loadTemplates(url, { signal: controller.signal });
  assert.equal(seenSignal, controller.signal);
});

test("loadTemplates: a trailing options object is not mistaken for a url — backward compatible with plain-string call sites", async (t) => {
  installFakeDom(t);
  const seen = [];
  patchGlobal(t, "fetch", async (url) => { seen.push(url); return { ok: true, text: async () => "" }; });

  await loadTemplates("/a-plain.html", "/b-plain.html"); // today's call shape — no options object at all
  assert.deepEqual(seen.sort(), ["/a-plain.html", "/b-plain.html"]);
});

// ── wireErrorBar: AbortError is a lifecycle event, not a failure ─────────────

/** Install a fake `window` (error/unhandledrejection EventTarget), a fake
 * `document` (getElementById → the errbar), and a fake `navigator.sendBeacon`
 * spy; returns handles to drive and inspect them. */
function installShellGlobals(t) {
  /** @type {Map<string, Set<Function>>} */
  const winListeners = new Map();
  const errbar = { textContent: "", hidden: true };
  const beacons = [];
  patchGlobal(t, "window", {
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type).add(fn);
    },
  });
  patchGlobal(t, "document", { getElementById: () => errbar });
  patchGlobal(t, "location", { hash: "#/x" });
  patchGlobal(t, "navigator", {
    sendBeacon: (url, body) => { beacons.push({ url, body }); return true; },
    userAgent: "test-agent",
  });
  const fire = (type, event) => { for (const fn of winListeners.get(type) ?? []) fn(event); };
  return { errbar, beacons, fire };
}

test("wireErrorBar: an AbortError from the 'error' hook is debug-logged, not painted into the errbar, and never beaconed", (t) => {
  const { errbar, beacons, fire } = installShellGlobals(t);
  wireErrorBar();

  const debugCalls = [];
  const origDebug = console.debug;
  console.debug = (...args) => debugCalls.push(args);
  try {
    fire("error", { error: new DOMException("aborted", "AbortError"), message: "AbortError: aborted" });
  } finally { console.debug = origDebug; }

  assert.equal(errbar.hidden, true, "errbar must stay hidden for an AbortError");
  assert.equal(debugCalls.length, 1, "console.debug called instead");
  assert.deepEqual(beacons, [], "never beaconed — the filter runs before the relay");
});

test("wireErrorBar: an AbortError from 'unhandledrejection' is debug-logged, not painted, and never beaconed", (t) => {
  const { errbar, beacons, fire } = installShellGlobals(t);
  wireErrorBar();

  fire("unhandledrejection", { reason: new DOMException("aborted", "AbortError") });

  assert.equal(errbar.hidden, true);
  assert.deepEqual(beacons, []);
});

test("wireErrorBar: a REAL error still paints the errbar and beacons /api/client-errors", (t) => {
  const { errbar, beacons, fire } = installShellGlobals(t);
  wireErrorBar();

  fire("error", { error: new Error("boom"), message: "boom" });

  assert.equal(errbar.hidden, false, "a genuine error still surfaces");
  assert.equal(errbar.textContent, "boom");
  assert.equal(beacons.length, 1, "a genuine error IS beaconed");
  const payload = JSON.parse(beacons[0].body);
  assert.equal(payload.msg, "boom");
  assert.equal(payload.src, "error");
  assert.equal(payload.url, "#/x");
  assert.equal(payload.ua, "test-agent");
});

test("wireErrorBar: an unhandledrejection with a real reason still paints the errbar and beacons", (t) => {
  const { errbar, beacons, fire } = installShellGlobals(t);
  wireErrorBar();

  fire("unhandledrejection", { reason: new Error("kaboom") });

  assert.equal(errbar.hidden, false);
  assert.match(errbar.textContent, /kaboom/);
  assert.equal(beacons.length, 1);
  assert.equal(JSON.parse(beacons[0].body).src, "unhandledrejection");
});
