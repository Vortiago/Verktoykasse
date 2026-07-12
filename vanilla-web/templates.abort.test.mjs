// Abort-semantics guards for templates.js (#61 / #66):
//   - loadTemplates(...urls, {signal}) passes the signal through to fetch, and
//     an aborted/failed fetch must NOT poison the module-level `inflight` memo —
//     a later call for the same url must retry, not silently no-op.
//   - concurrent calls for the SAME url must share one fetch and one DOM
//     append, never double-fetch or double-inline (#66).
//
// wireErrorBar's own abort-filter guards (AbortError debug-logged, not painted
// or beaconed) live in chrome.test.mjs alongside chrome.js.
//
// No jsdom: document/fetch/navigator are faked on globalThis per test, same
// pattern as the other *.test.mjs files in this package.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTemplates } from "./templates.js";
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

// ── loadTemplates: abort must not poison the `inflight` memo ─────────────────

test("loadTemplates: an aborted fetch does NOT mark the url fetched — a later call retries it cleanly", async (t) => {
  installFakeDom(t);
  const url = "/abort-retry-1.html"; // unique per test — `inflight` is module-level and persists across tests
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

test("loadTemplates: concurrent calls for the SAME url share one fetch and one DOM append (#66)", async (t) => {
  let calls = 0;
  let appends = 0;
  patchGlobal(t, "document", {
    createElement: () => ({ hidden: false, innerHTML: "", children: [] }),
    body: { append: () => { appends++; } },
  });
  patchGlobal(t, "fetch", async () => {
    calls++;
    await Promise.resolve(); // force both callers to race past the check before either resolves
    return { ok: true, text: async () => "" };
  });

  const url = "/concurrent-same-url.html";
  await Promise.all([loadTemplates(url), loadTemplates(url)]);

  assert.equal(calls, 1, "exactly one fetch for two concurrent callers of the same url");
  assert.equal(appends, 1, "exactly one DOM append — no duplicate <template> inlined");
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
