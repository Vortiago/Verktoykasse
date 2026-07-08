// GREEN regression guard for the <vc-*> custom-element lifecycle. Cycling a batch
// of every scalar atom through connect (append → connectedCallback builds via the
// factory) and disconnect (remove → disconnectedCallback aborts the mount) many
// times must leave: zero surviving detached subtrees, a DOM census back at
// baseline (no orphaned popovers, no <link> accumulation), and a flat heap. A leak
// means disconnectedCallback's abort didn't free the factory mount.
//
// Integer gates (survivors, census) are exact; heap is a corroborating ratio. The
// detector's sensitivity is pinned separately by memory-detector-selftest.spec.js.
import { test, expect } from "@playwright/test";
import { cdpClient, settleGC, heapUsed, domCensus, tagBySelector, survivorsAfterGC, resetRefs, medianRatio } from "../../lib/mem.js";

test("cycling <vc-*> custom elements through connect/disconnect leaks no DOM, listeners or heap", async ({ page }) => {
  test.slow(); // many GC cycles
  const client = await cdpClient(page);
  await page.goto("/testing/fixtures/vc-lifecycle.html");
  await page.waitForFunction(() => typeof (/** @type {any} */ (window)).__mount === "function");

  /** Mount a batch and wait until every custom element has built its inner node. */
  const mount = async (copies) => {
    await page.evaluate((c) => (/** @type {any} */ (window)).__mount(c), copies);
    await page.waitForFunction(() => (/** @type {any} */ (window)).__built(), null, { timeout: 5000 });
  };
  const unmount = () => page.evaluate(() => (/** @type {any} */ (window)).__unmount());

  // Warmup: two full mount/unmount passes so each tag's lazy template + CSS load
  // once (a factory's assets load the first time it renders) and JIT warms.
  for (let r = 0; r < 2; r++) { await mount(2); await unmount(); }
  await resetRefs(page);

  // The leak signal is GROWTH ACROSS CYCLES: warmup leaves a fixed pool of inlined
  // <template>s and component <link>s, so we sample the RESTING (fully unmounted)
  // DOM once per round and assert it's flat. A real per-cycle leak (retained
  // subtree, re-injected stylesheet, orphaned popover) makes these climb.
  const heaps = [];
  let maxSurvivors = 0;
  const rounds = 5;
  const census = [];
  for (let r = 0; r < rounds; r++) {
    await mount(3);
    // Tag the whole mounted batch; after unmount every node must be GC'd.
    await tagBySelector(page, "#mount .batch, #mount .batch *", { reset: true });
    await unmount();
    maxSurvivors = Math.max(maxSurvivors, await survivorsAfterGC(client, page));
    heaps.push(await heapUsed(client, page));
    census.push(await domCensus(page)); // resting DOM, fully unmounted
  }

  const spread = (key) => Math.max(...census.map((c) => c[key])) - Math.min(...census.map((c) => c[key]));
  // Exact integer gates: detached subtrees collected every cycle, nothing accruing.
  expect(maxSurvivors, "detached custom-element subtrees must be collected each cycle").toBe(0);
  expect(spread("total"), "total DOM returns to baseline after each unmount").toBeLessThanOrEqual(2);
  expect(spread("bodyChildren"), "no popover/tooltip nodes accumulate in <body>").toBeLessThanOrEqual(2);
  expect(spread("headLinks"), "component stylesheets load once, not per cycle").toBeLessThanOrEqual(1);
  // Corroborating heap slope.
  expect(medianRatio(heaps), "heap not trending up across connect/disconnect cycles").toBeLessThan(1.5);
});
