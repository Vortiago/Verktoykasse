// #72 — the interaction hold, proved in a real browser.
//
// This is the toolkit's own instance of the clobber guard reference/testing.md
// prescribes ("focus every interactive control → cross an update → assert no node
// was rebuilt out from under the focus"). It lives here rather than only in
// render.test.mjs because the bug is made of semantics no hand-written double can
// vouch for: `focusout` fires BEFORE the incoming element is focused and parks
// document.activeElement on <body> for its duration, so the old flush re-read the
// guards, saw an idle host, and swapped on top of the element about to be focused.
// And a Range that SPANS a node intersects it while neither endpoint is inside.
import { test, expect } from "@playwright/test";

const FIXTURE = "/testing/fixtures/render-hold.html";

test("a deferred swap does not land on the element receiving focus, and lands once focus leaves", async ({ page }) => {
  await page.goto(FIXTURE);
  await expect(page.locator("#a")).toBeVisible();

  await page.locator("#a").focus();
  const buildsBefore = await page.evaluate(() => window.__builds);

  // Two poll ticks arrive while #a is focused. Both must be held, latest-wins.
  expect(await page.evaluate(() => window.__render("t1"))).toBe(true);
  expect(await page.evaluate(() => window.__render("t2"))).toBe(true);
  expect(await page.evaluate(() => window.__builds)).toBe(buildsBefore);

  await page.evaluate(() => window.__stamp());

  // Tab from #a to #b — both inside the region. This is the reported repro.
  await page.keyboard.press("Tab");

  expect(await page.evaluate(() => window.__stamped())).toBe(true);
  expect(await page.evaluate(() => window.__builds)).toBe(buildsBefore);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("b");

  // Focus genuinely leaves the region: now the held swap is owed and must land,
  // carrying the LATEST build, not the first one that was deferred.
  await page.locator("#outside").focus();
  await expect(page.locator("#text")).toHaveText("build:t2");
  expect(await page.evaluate(() => window.__builds)).toBe(buildsBefore + 1);
  expect(await page.evaluate(() => window.__stamped())).toBe(false);
});

test("programmatic focus inside the region is protected too, not just Tab", async ({ page }) => {
  await page.goto(FIXTURE);
  await page.locator("#a").focus();
  await page.evaluate(() => window.__render("t1"));
  await page.evaluate(() => window.__stamp());

  // The issue reports the same failure via b.focus() as via Tab.
  await page.evaluate(() => document.getElementById("b")?.focus());

  expect(await page.evaluate(() => window.__stamped())).toBe(true);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("b");
});

test("a button inside a held region still receives its click — the flush must not remove it mid-mousedown", async ({ page }) => {
  await page.goto(FIXTURE);
  await page.locator("#a").focus();
  await page.evaluate(() => window.__render("t1")); // held by the focus on #a

  await page.locator("#btn").click();

  // Chrome focuses a button on mousedown, so this click DOES fire focusout with
  // relatedTarget=#btn. If that assertion fails the scenario never reproduced and
  // the click assertion below is vacuous — so check it explicitly.
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("btn");
  expect(await page.evaluate(() => window.__clicks)).toBe(1);
});

test("a selection spanning the region holds a swap, though neither endpoint is inside it", async ({ page }) => {
  await page.goto(FIXTURE);
  const buildsBefore = await page.evaluate(() => window.__builds);

  // Precondition: a real Range that spans #region without either endpoint in it.
  // If the browser disagreed, the hold below would be testing nothing.
  expect(await page.evaluate(() => window.__selectSpanningRegion()))
    .toEqual({ isCollapsed: false, spans: true });

  expect(await page.evaluate(() => window.__render("t1"))).toBe(true);
  expect(await page.evaluate(() => window.__builds)).toBe(buildsBefore);

  // Collapse the selection: selectionchange fires and the held swap lands.
  await page.evaluate(() => document.getSelection()?.removeAllRanges());
  await expect(page.locator("#text")).toHaveText("build:t1");
});

test("defer:false reports the hold and arms nothing — the caller's own retry lands the fresh build", async ({ page }) => {
  await page.goto(FIXTURE);
  await page.locator("#a").focus();
  const buildsBefore = await page.evaluate(() => window.__builds);

  expect(await page.evaluate(() => window.__render("t1", { defer: false }))).toBe(true);
  expect(await page.evaluate(() => window.__builds)).toBe(buildsBefore);

  // Focus leaves. With nothing armed, nothing flushes on its own.
  await page.locator("#outside").focus();
  expect(await page.evaluate(() => window.__builds)).toBe(buildsBefore);

  // The app's retry re-derives from current state and swaps.
  expect(await page.evaluate(() => window.__render("t2", { defer: false }))).toBe(false);
  await expect(page.locator("#text")).toHaveText("build:t2");
});
