// Shared memory-leak measurement harness for the Playwright browser tier.
//
// Design rule: the PASS/FAIL gates are deterministic integers — WeakRef
// survivors after a forced GC, and a DOM-node census — never raw heap bytes.
// Heap is sampled only as a corroborating slope over many cycles, because byte
// counts wiggle and would make the suite flaky. GC is driven through CDP
// (HeapProfiler.collectGarbage, twice — V8 needs ~2 passes to sweep WeakRef /
// FinalizationRegistry) with window.gc() as a backstop.
//
// This file is copied verbatim into each skill's testing/lib/ so the two skills'
// suites stay independent (no cross-skill imports). Its own correctness is pinned
// by memory-detector-selftest.spec.js, which points it at a known leak and
// asserts it trips.

/** Open a CDP session for low-level GC + heap reads. @param {import('@playwright/test').Page} page */
export async function cdpClient(page) {
  const client = await page.context().newCDPSession(page);
  await client.send("HeapProfiler.enable");
  return client;
}

/** Force a deterministic garbage collection: CDP collectGarbage twice, plus a
 * window.gc() backstop (present when Chromium is launched with
 * --js-flags=--expose-gc). Two passes because a WeakRef/FinalizationRegistry
 * target can survive a single sweep. */
export async function settleGC(client, page) {
  await client.send("HeapProfiler.collectGarbage");
  await client.send("HeapProfiler.collectGarbage");
  // window.gc() backstop, then settle one macrotask so abort handlers run before we sample
  await page.evaluate(() => { /** @type {any} */ (globalThis).gc?.(); return new Promise((r) => setTimeout(r, 0)); }).catch(() => {});
}

/** Used JS heap in bytes (corroborating signal only). Prefers the CDP reading;
 * falls back to performance.memory (present under --enable-precise-memory-info). */
export async function heapUsed(client, page) {
  try {
    const { usedSize } = await client.send("Runtime.getHeapUsage");
    return usedSize;
  } catch {
    return page ? page.evaluate(() => /** @type {any} */ (performance).memory?.usedJSHeapSize ?? 0) : 0;
  }
}

/** A census of live DOM that a leak inflates: total element count, <head> <link>
 * count (the loadCSS surface), and document.body child count (orphaned popovers
 * /tooltips re-parent to body). All in-page, deterministic. */
export async function domCensus(page) {
  return page.evaluate(() => ({
    total: document.getElementsByTagName("*").length,
    headLinks: document.head.querySelectorAll("link").length,
    bodyChildren: document.body.childElementCount,
  }));
}

/** Tag the elements matching `selector` as "should be collectable after the next
 * unmount" by stashing WeakRefs to them. Accumulates across calls unless reset.
 * @returns {Promise<number>} how many refs are now tracked. */
export function tagBySelector(page, selector, { reset = false } = {}) {
  return page.evaluate(({ selector, reset }) => {
    const w = /** @type {any} */ (window);
    if (reset || !w.__leakRefs) w.__leakRefs = [];
    for (const n of document.querySelectorAll(selector)) w.__leakRefs.push(new WeakRef(n));
    return w.__leakRefs.length;
  }, { selector, reset });
}

/** How many tagged nodes are STILL reachable (survived GC). 0 == clean teardown. */
export function survivors(page) {
  return page.evaluate(() => {
    const refs = /** @type {any} */ (window).__leakRefs || [];
    return refs.reduce((c, /** @type {WeakRef<object>} */ r) => c + (r.deref() ? 1 : 0), 0);
  });
}

/** Reset the tracked-ref set (call at the start of a fresh measurement run). */
export function resetRefs(page) {
  return page.evaluate(() => { /** @type {any} */ (window).__leakRefs = []; });
}

/** Survivors, but GC up to `tries` times and stop as soon as it reaches 0. V8
 * occasionally needs more than one sweep to reclaim a just-detached subtree, so a
 * single GC can report a transient survivor; a REAL leak never drains to 0. This
 * turns the deterministic integer gate from "0 after one GC" into "0 within a
 * bounded GC budget", killing the flake without weakening the leak signal. */
export async function survivorsAfterGC(client, page, tries = 6) {
  let n = Infinity;
  for (let i = 0; i < tries; i++) {
    await settleGC(client, page);
    n = await survivors(page);
    if (n === 0) break;
  }
  return n;
}

/** Ratio of the median of the last k samples to the median of the first k — a
 * leak pushes this above 1 over a long run; noise keeps it ~1. */
export function medianRatio(ys, k = Math.max(3, Math.floor(ys.length / 4))) {
  if (ys.length === 0) return 1; // no samples → treat as no growth (avoid NaN)
  const med = (arr) => { const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const first = med(ys.slice(0, k));
  const last = med(ys.slice(-k));
  return first === 0 ? (last === 0 ? 1 : Infinity) : last / first;
}
