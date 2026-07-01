// The live-update tier — the surface the user's OOM points at: "how the UI
// retrieves data / updates". Drives testing/fixtures/live-harness.js, which
// mounts a real view (store.subscribe + liveSSE + a reconcileList'd live list +
// a per-mount CSS link) and unmounts by aborting one AbortController, the shell.js
// contract. Three arms:
//   1. GREEN  — mount/unmount churn releases SSE, subscription, <link> and DOM.
//   2. RED    — ?leaky=1 (signal-less subscribe / loadCSS / never-aborted SSE)
//               trips the detector, proving arm 1 isn't vacuous.
//   3. GREEN  — a stable mount under heavy re-render churn collects dropped rows.
import { test, expect } from "@playwright/test";
import { cdpClient, settleGC, heapUsed, domCensus, survivorsAfterGC, resetRefs, medianRatio } from "../../lib/mem.js";

const FIXTURE = "/testing/fixtures/live-harness.html";
const sseCount = (page) => page.evaluate(async () => (await (await fetch("/api/test/sse-count")).json()).count);
const mount = (page) => page.evaluate(() => (/** @type {any} */ (window)).__mountLive());
const unmount = (page) => page.evaluate(() => (/** @type {any} */ (window)).__unmountLive());

test("mount/unmount churn releases the SSE connection, subscription, CSS link and DOM", async ({ page }) => {
  test.slow();
  const client = await cdpClient(page);
  await page.goto(FIXTURE);
  await page.waitForFunction(() => typeof (/** @type {any} */ (window)).__mountLive === "function");

  // Warm up, then settle to a baseline with nothing mounted.
  for (let i = 0; i < 5; i++) { await mount(page); await unmount(page); }
  await settleGC(client, page);
  await expect.poll(() => sseCount(page), { timeout: 5000 }).toBe(0); // all EventSources closed
  await resetRefs(page);
  const base = await domCensus(page);

  const heaps = [];
  for (let i = 0; i < 40; i++) {
    await mount(page);
    await unmount(page);
    await settleGC(client, page);
    heaps.push(await heapUsed(client, page));
  }
  expect(await survivorsAfterGC(client, page), "every view root + row is collected after unmount").toBe(0);
  await expect.poll(() => sseCount(page), { timeout: 5000 }).toBe(0); // back to baseline, not climbing
  const census = await domCensus(page);
  expect(census.headLinks, "per-mount <link> auto-removed on abort").toBeLessThanOrEqual(base.headLinks);
  expect(census.total, "DOM returns to ~baseline").toBeLessThanOrEqual(base.total + 2);
  expect(medianRatio(heaps), "heap not trending up").toBeLessThan(1.5);
});

test("the detector trips when teardown is broken (?leaky=1) — confirms the green arm isn't vacuous", async ({ page }) => {
  const client = await cdpClient(page);
  await page.goto(`${FIXTURE}?leaky=1`);
  await page.waitForFunction(() => typeof (/** @type {any} */ (window)).__mountLive === "function");

  await settleGC(client, page);
  await resetRefs(page);
  const baseCensus = await domCensus(page);

  for (let i = 0; i < 10; i++) { await mount(page); await unmount(page); }

  // Deterministic in-page gates that a single broken contract makes climb:
  // the signal-less subscribe pins every view root, and the signal-less loadCSS
  // piles a <link> into <head> per mount. (The SSE-close path is proven positively
  // by the green test returning sse-count to 0, and at the node tier.)
  expect(await survivorsAfterGC(client, page), "roots are pinned by the retained subscription").toBeGreaterThan(0);
  expect((await domCensus(page)).headLinks, "signal-less loadCSS piles up <link>s")
    .toBeGreaterThan(baseCensus.headLinks);
});

test("a stable mount under heavy re-render churn collects every dropped row (reconcileList)", async ({ page }) => {
  test.slow();
  const client = await cdpClient(page);
  await page.goto(FIXTURE);
  await page.waitForFunction(() => typeof (/** @type {any} */ (window)).__mountLive === "function");

  await mount(page);
  await resetRefs(page); // ignore the root + initial rows; track only churned rows

  // Slide a 10-item window across 60 ticks so each tick drops one key and adds one.
  for (let k = 0; k < 60; k++) {
    await page.evaluate((k) => {
      const items = Array.from({ length: 10 }, (_, j) => ({ id: k + j, label: `row ${k + j}` }));
      (/** @type {any} */ (window)).__store.set(items);
    }, k);
  }
  await page.evaluate(() => (/** @type {any} */ (window)).__store.set([])); // drop them all

  expect(await survivorsAfterGC(client, page), "rows dropped by reconcileList are not retained").toBe(0);
  await unmount(page);
});
