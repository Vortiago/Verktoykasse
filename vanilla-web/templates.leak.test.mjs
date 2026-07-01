// Memory-leak guards for templates.js — the DOM-free teardown contract: every().
//
// every() is the polling primitive (livePoll builds on it, views call it for
// refresh loops). The leak it must never reintroduce: an interval that keeps
// firing — and keeps whatever its callback closes over alive — after the view's
// mount signal aborts. The abort wiring must also be {once:true} so a long-lived
// signal can't accumulate one dead abort-listener per every() call.
//
// loadCSS's link-removal-on-abort needs a real <head>, so it is asserted in the
// browser tier (testing/tests/e2e/memory-live-update.spec.js), not here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { every } from "./templates.js";

test("every() fires once per interval while the signal is live", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const fn = t.mock.fn();
  const controller = new AbortController();

  every(fn, 1000, controller.signal);
  t.mock.timers.tick(3000);

  assert.equal(fn.mock.callCount(), 3, "three ticks at 1000ms over 3000ms");
});

test("every() stops firing after the signal aborts — the interval is cleared, not just ignored", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const fn = t.mock.fn();
  const controller = new AbortController();

  every(fn, 1000, controller.signal);
  t.mock.timers.tick(1000);
  assert.equal(fn.mock.callCount(), 1, "one tick before abort");

  controller.abort();
  t.mock.timers.tick(10_000); // ten more intervals would fire if the timer leaked
  assert.equal(fn.mock.callCount(), 1, "call count is frozen after abort");
});

test("every() registers its abort listener with { once: true } so it can't accumulate on a long-lived signal", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const controller = new AbortController();
  // Spy BEFORE every() so we capture its registration; the spy calls through,
  // so the real clearInterval-on-abort wiring still happens.
  t.mock.method(controller.signal, "addEventListener");

  every(() => {}, 1000, controller.signal);

  const abortCalls = controller.signal.addEventListener.mock.calls
    .filter((c) => c.arguments[0] === "abort");
  assert.equal(abortCalls.length, 1, "exactly one abort listener registered");
  assert.deepEqual(abortCalls[0].arguments[2], { once: true }, "registered with { once: true }");
});
