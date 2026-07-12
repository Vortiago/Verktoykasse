// Visual regression (issue #56) — OPT-IN "visual" project only; see
// playwright.config.js for why this needs a project-existence gate rather than
// the usual testMatch/testIgnore split: `npx playwright test` (bare) never
// touches this file, `npx playwright test --project=visual` does.
//
// The catalogue (`/preview.html`) already enumerates itself — one card per
// `*.preview.js` variant, generated into `previews/registry.js` by
// `previews/scan.mjs` (serve.mjs reruns it on boot). This spec adds no
// per-component knowledge: it walks the rail exactly like
// memory-component-cycle.spec.js does, then, for each component shown, reads
// its rendered `.frame`s straight off the DOM — one per variant, captioned
// with the variant name the catalogue already prints. A brand-new component
// gets covered the moment it grows a `*.preview.js`, zero wiring here.
//
// Both themes are driven by `page.emulateMedia({ colorScheme })`, not the
// harness's theme button/localStorage: tokens.css's `color-scheme: light dark`
// on `:root` is left unconstrained by `wireTheme()`'s default "auto" (a fresh
// browser context has no persisted choice), so `light-dark()` resolves off the
// EMULATED media feature exactly as it would off a real OS preference.
//
// Every assertion is `expect.soft(...)`: a soft failure (including a MISSING
// baseline — Playwright writes the new PNG as a side effect either way) never
// aborts the test, so a from-scratch run against zero committed baselines still
// walks every card in both themes and produces the full snapshot set in one
// pass — CI's job, per the pinned-environment rule (CONTEXT.md), not this repo.
import { test, expect } from "@playwright/test";
import { readRailHrefs } from "../../lib/rail.js";

/** @type {readonly ("light" | "dark")[]} */
const THEMES = ["light", "dark"];

test("every preview card matches its baseline in both themes", async ({ page }) => {
  test.slow(); // every component x every variant x 2 themes

  const hrefs = await readRailHrefs(page);

  for (const href of hrefs) {
    const title = decodeURIComponent(String(href).replace(/^#\/?/, ""));

    // location.hash = same value is a no-op (no hashchange) — fine: the boot
    // sequence's own initial show() already rendered hrefs[0], so the
    // aria-current check below is already true by the time we get here.
    await page.evaluate((h) => { location.hash = h; }, href);
    await page.waitForFunction(
      (h) => !!document.querySelector(`#rail a[href="${h}"]`)?.hasAttribute("aria-current"),
      href,
      { timeout: 10000 },
    );

    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });

      const frames = page.locator("#canvas .frame");
      const count = await frames.count();
      for (let i = 0; i < count; i++) {
        const frame = frames.nth(i);
        const rawName = (await frame.locator("[data-slot=name]").textContent()) ?? String(i);
        const variant = rawName.trim().replace(/[^\w-]+/g, "_"); // filename-safe
        await expect.soft(frame, `${title} · ${variant} · ${theme}`)
          .toHaveScreenshot(`${title}-${variant}-${theme}.png`);
      }
    }
  }
});
