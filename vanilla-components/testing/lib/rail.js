// Shared preview-catalogue rail walk for the Playwright browser tier — every
// e2e spec that drives the FULL component catalogue (visual.spec.js,
// memory-component-cycle.spec.js) starts the same way: open preview.html, wait
// for its #rail nav, and read every component href off it. One helper so that
// preamble can't drift between specs the way it already had.
import { expect } from "@playwright/test";

/** Navigate to the preview catalogue and read every component href off its
 * #rail nav, asserting the rail is non-empty (empty means scan.mjs's registry
 * generation broke, not "there are no components").
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>} */
export async function readRailHrefs(page) {
  await page.goto("/preview.html");
  await page.waitForSelector("#rail a");
  const hrefs = await page.$$eval("#rail a", (els) => els.map((a) => a.getAttribute("href")).filter(Boolean));
  expect(hrefs.length, "preview catalogue is non-empty").toBeGreaterThan(0);
  return /** @type {string[]} */ (hrefs);
}
