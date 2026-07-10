// Behaviour guards for api-client.js — the #48 AbortSignal.any() composition
// and the get()/del() dropped-options bug it was filed alongside.
//
// No real network: fetch is stubbed on globalThis per test (Node ships a real
// one, so the prior value is captured and restored). DOMException is a Node
// global, used to fake what a real aborted fetch() throws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { request, get, post, put, del, ApiError } from "./api-client.js";
import { patchGlobal } from "./testing-util.mjs";

/** Install a fetch double for one test, restoring the prior value after. */
const installFetch = (t, impl) => patchGlobal(t, "fetch", impl);

test("request() composes a caller signal with the timeout signal instead of letting it win", (t) => {
  /** @type {AbortSignal} */
  let captured;
  installFetch(t, async (_url, opts) => { captured = opts.signal; return new Promise(() => {}); }); // never settles
  const controller = new AbortController();

  request("/x", { signal: controller.signal }).catch(() => {}); // fire-and-forget; only the signal matters here

  assert.notEqual(captured, controller.signal, "fetch got a composed AbortSignal.any(...), not the bare caller signal — the #48 bug was the two being equal");
  assert.equal(captured.aborted, false, "not aborted yet");

  controller.abort();
  assert.equal(captured.aborted, true, "aborting the CALLER's controller still aborts the composed signal");
  assert.equal(/** @type {DOMException} */ (captured.reason).name, "AbortError", "the caller's abort reason propagates through AbortSignal.any");
});

test("request() still classifies a timeout as ApiError even with a (non-aborting) caller signal present", async (t) => {
  installFetch(t, async () => { throw new DOMException("The operation timed out.", "TimeoutError"); });
  const controller = new AbortController(); // present, but never aborted — proves the TIMEOUT tripped, not the caller
  await assert.rejects(() => request("/x", { signal: controller.signal }), (/** @type {unknown} */ err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(/** @type {ApiError} */ (err).status, 0);
    assert.match(/** @type {ApiError} */ (err).message, /timed out/i);
    return true;
  });
});

test("request() rethrows a genuine AbortError as-is — NOT wrapped in ApiError, so callers can still classify it by name", async (t) => {
  installFetch(t, async () => { throw new DOMException("aborted", "AbortError"); });
  await assert.rejects(() => request("/x", { signal: new AbortController().signal }), (/** @type {unknown} */ err) => {
    assert.ok(err instanceof DOMException);
    assert.equal(/** @type {DOMException} */ (err).name, "AbortError");
    return true;
  });
});

test("get()/del() forward their options argument to request() (the #48 bonus bug: they used to drop it)", async (t) => {
  /** @type {RequestInit & { signal?: AbortSignal }} */
  let captured;
  installFetch(t, async (_url, opts) => { captured = opts; return { ok: true, status: 204 }; });

  const controller = new AbortController();
  await get("/x", { signal: controller.signal });
  assert.notEqual(captured.signal, controller.signal, "get()'s signal reached fetch (composed, not dropped)");

  await del("/y", { headers: { "X-Test": "1" } });
  assert.equal(/** @type {Record<string,string>} */ (captured.headers)["X-Test"], "1", "del()'s custom header reached fetch");
  assert.equal(captured.method, "DELETE");
});

test("post()/put() accept an optional third options param and merge it in", async (t) => {
  /** @type {RequestInit & { signal?: AbortSignal }} */
  let captured;
  installFetch(t, async (_url, opts) => { captured = opts; return { ok: true, status: 204 }; });

  const controller = new AbortController();
  await post("/x", { a: 1 }, { signal: controller.signal, headers: { "X-Test": "2" } });
  assert.equal(captured.method, "POST");
  assert.equal(captured.body, JSON.stringify({ a: 1 }));
  assert.equal(/** @type {Record<string,string>} */ (captured.headers)["X-Test"], "2");
  assert.notEqual(captured.signal, controller.signal, "signal made it through, composed with the timeout");

  await put("/x", { b: 2 }, { headers: { "X-Test": "3" } });
  assert.equal(captured.method, "PUT");
  assert.equal(captured.body, JSON.stringify({ b: 2 }));
  assert.equal(/** @type {Record<string,string>} */ (captured.headers)["X-Test"], "3");
});
