// #53 — shell.js: view-level error containment.
//
// mount() throwing must not brick the app: a textContent-only fallback renders
// into the stage, every OTHER view still switches normally, and clicking the
// failed view's own nav link again retries (currentView reset to null fixes
// the no-op bug — see shell.js's swap()). Uses the shell-harness fixture: the
// REAL canon shell.js, running against test views served by serve.mjs's
// TEST-only /views/registry.js route (see serve.mjs).
import { test, expect } from "@playwright/test";

const FIXTURE = "/testing/fixtures/shell-harness.html";

test("a throwing mount() renders a fallback, other views keep working, and the failed link retries", async ({ page }) => {
  await page.goto(`${FIXTURE}#/broken`);

  const fallback = page.getByTestId("viewError");
  await expect(fallback).toBeVisible();
  await expect(fallback).toContainText("This view failed to load.");
  await expect(page.getByTestId("retryLink")).toHaveAttribute("href", "#/broken");

  // The rest of the app is NOT bricked — a different view mounts fine.
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.getByTestId("msg")).toHaveText("Home OK");
  // A failed boot mount counts as "switched once" (#60) — the FIRST successful
  // navigation after it must retitle the tab, not skip the update.
  await expect(page).toHaveTitle(/Home/);

  // Clicking the FAILED view's own link again must retry, not no-op (the #53
  // recovery bug: currentView used to stay pinned to the failed view's id).
  await page.getByRole("link", { name: "Broken" }).click();
  await expect(page.getByTestId("viewError")).toBeVisible();
});

test("the fallback (and a successful mount) move focus to the stage", async ({ page }) => {
  await page.goto(`${FIXTURE}#/broken`);
  await expect(page.getByTestId("viewError")).toBeVisible();

  const stageFocused = await page.evaluate(() => document.activeElement === document.getElementById("stage"));
  expect(stageFocused, "the failure fallback also receives focus (#60 composes with #53)").toBe(true);
});
