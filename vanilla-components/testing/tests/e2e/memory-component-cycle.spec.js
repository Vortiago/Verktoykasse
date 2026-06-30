// GREEN regression guard for every component factory. Drives the real component
// catalogue (preview.html): preview.js show() is already a true mount/unmount
// loop — navigating the hash aborts the prior AbortController and replaceChildren()s
// the canvas, exactly the teardown an app view gets. Cycling every variant many
// times must leave: zero surviving detached frames, a DOM census back at baseline
// (no orphaned popovers/tips in <body>, no <link> accumulation), and a flat heap.
//
// Integer gates (survivors, census) are exact; heap is a corroborating ratio.
// The detector's sensitivity is pinned separately by memory-detector-selftest.spec.js.
import { test, expect } from "@playwright/test";
import { cdpClient, settleGC, heapUsed, domCensus, tagBySelector, survivorsAfterGC, resetRefs, medianRatio } from "../../lib/mem.js";

test("cycling every preview component through mount/unmount leaks no DOM, listeners or heap", async ({ page }) => {
  test.slow(); // many GC cycles
  const client = await cdpClient(page);
  await page.goto("/preview.html");
  await page.waitForSelector("#rail a");

  const hrefs = await page.$$eval("#rail a", (els) => els.map((a) => a.getAttribute("href")).filter(Boolean));
  expect(hrefs.length, "preview catalogue is non-empty").toBeGreaterThan(0);

  /** Navigate to a component and wait for its variants to render. */
  const show = async (href) => {
    await page.evaluate((h) => { location.hash = h; }, href);
    await page.waitForFunction(() => (document.querySelector("#canvas")?.childElementCount ?? 0) > 0, null, { timeout: 5000 });
  };

  // Warmup: two full passes so all lazy template/CSS loads settle (a component's
  // assets load once, the first time it renders) and JIT warms — unmeasured.
  for (let r = 0; r < 2; r++) for (const h of hrefs) await show(h);
  await resetRefs(page);

  // The leak signal is GROWTH ACROSS CYCLES, not an absolute count: warmup leaves
  // a fixed pool of inlined <template>s and component <link>s, so we sample the
  // resting DOM at the SAME component (hrefs[0]) once per round and assert the
  // census is FLAT across rounds. A real per-cycle leak (orphaned popover,
  // re-injected stylesheet, retained subtree) makes these climb monotonically.
  const heaps = [];
  let maxSurvivors = 0;
  const rounds = 5;
  const census = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < hrefs.length; i++) {
      await show(hrefs[i]);
      // Tag THIS component's rendered frames; after we navigate away they must be GC'd.
      await tagBySelector(page, "#canvas > *", { reset: true });
      await show(hrefs[(i + 1) % hrefs.length]); // unmount the prior component
      maxSurvivors = Math.max(maxSurvivors, await survivorsAfterGC(client, page));
      heaps.push(await heapUsed(client, page));
    }
    await show(hrefs[0]); // rest state — sample comparably each round
    await settleGC(client, page);
    census.push(await domCensus(page));
  }

  const spread = (key) => Math.max(...census.map((c) => c[key])) - Math.min(...census.map((c) => c[key]));
  // Exact integer gates: detached frames collected every cycle, nothing accruing.
  expect(maxSurvivors, "detached preview frames must be collected each cycle").toBe(0);
  expect(spread("total"), "total DOM is flat across cycles (no retained subtrees)").toBeLessThanOrEqual(2);
  expect(spread("bodyChildren"), "no popover/tooltip nodes accumulate in <body>").toBeLessThanOrEqual(2);
  expect(spread("headLinks"), "stylesheets don't re-inject across cycles").toBeLessThanOrEqual(1);
  // Corroborating heap slope.
  expect(medianRatio(heaps), "heap not trending up across cycles").toBeLessThan(1.5);
});
