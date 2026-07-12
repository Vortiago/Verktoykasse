// Abort-semantics guard for chrome.js's wireErrorBar (#61 / #62):
//   - wireErrorBar filters AbortError at both the error and unhandledrejection
//     hooks (console.debug instead of painting the errbar), and never beacons
//     one to /api/client-errors.
//
// No jsdom: window/document/location/navigator are faked on globalThis per
// test, same pattern as the other *.test.mjs files in this package.
import { test } from "node:test";
import assert from "node:assert/strict";
import { wireErrorBar } from "./chrome.js";
import { patchGlobal, fakeEventTarget } from "./testing-util.mjs";

// ── wireErrorBar: AbortError is a lifecycle event, not a failure ─────────────

/** Install a fake `window` (error/unhandledrejection EventTarget, via
 * fakeEventTarget — dispatch(type, event) hands the event through), a fake
 * `document` (getElementById → the errbar), and a fake `navigator.sendBeacon`
 * spy; returns handles to drive and inspect them. */
function installShellGlobals(t) {
  const win = fakeEventTarget();
  const errbar = { textContent: "", hidden: true };
  const beacons = [];
  patchGlobal(t, "window", win);
  patchGlobal(t, "document", { getElementById: () => errbar });
  patchGlobal(t, "location", { hash: "#/x" });
  patchGlobal(t, "navigator", {
    sendBeacon: (url, body) => { beacons.push({ url, body }); return true; },
    userAgent: "test-agent",
  });
  return { errbar, beacons, fire: win.dispatch };
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
