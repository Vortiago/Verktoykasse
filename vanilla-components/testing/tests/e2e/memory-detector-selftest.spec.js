// Tracer bullet for the browser tier: prove the shared mem.js harness actually
// DETECTS a real leak, so the green suites can't pass vacuously. It points the
// identical GC + WeakRef-survivor + DOM-census machinery at testing/fixtures/
// leaky.js, which builds real tooltips WITHOUT a signal (dispose never wired →
// tips pile into <body> forever). If a future change weakened the harness so it
// could no longer see this, THIS spec fails first.
import { test, expect } from "@playwright/test";
import { cdpClient, settleGC, survivors, domCensus, resetRefs } from "../../lib/mem.js";

test("mem.js trips on a deliberately-leaked component (harness self-test)", async ({ page }) => {
  const client = await cdpClient(page);
  await page.goto("/testing/fixtures/leaky.html");
  await page.waitForFunction(() => typeof (/** @type {any} */ (window).__leakCycle) === "function");

  await settleGC(client, page);
  await resetRefs(page);
  const before = await domCensus(page);

  // Build 30 signal-less tooltips; drop all strong refs; force GC.
  await page.evaluate(() => (/** @type {any} */ (window)).__leakCycle(30));
  await settleGC(client, page);

  // A working detector MUST see survivors (the tips outlived GC) and a fuller <body>.
  expect(await survivors(page), "leaked tips survive GC").toBeGreaterThan(0);
  const after = await domCensus(page);
  expect(after.bodyChildren, "leaked tips pile into <body>").toBeGreaterThan(before.bodyChildren);
});
