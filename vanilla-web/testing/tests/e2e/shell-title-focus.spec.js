// #60 — shell.js: a real view switch updates document.title and moves focus
// to the stage (the SPA route-change a11y gap: an MPA gives both for free).
import { test, expect } from "@playwright/test";

const FIXTURE = "/testing/fixtures/shell-harness.html";

test("hashchange to a real switch updates document.title and focuses the stage", async ({ page }) => {
  await page.goto(`${FIXTURE}#/home`);
  await expect(page.getByTestId("msg")).toHaveText("Home OK");
  const bootTitle = await page.title();

  await page.getByRole("link", { name: "Slow" }).click();
  await expect(page.getByTestId("msg")).toHaveText("Slow OK", { timeout: 5000 }); // mounts after ~3s

  await expect.poll(() => page.title()).toContain("Slow");
  expect(await page.title()).not.toBe(bootTitle);

  const stageFocused = await page.evaluate(() => document.activeElement === document.getElementById("stage"));
  expect(stageFocused).toBe(true);
});
