// #61 — abort semantics: a cancelled mount must not surface a phantom error.
//
// Navigating away from a slow-mounting view (routine — two quick nav clicks)
// aborts its controller, so its in-flight mount() rejects with AbortError.
// That must be classified as normal shutdown end-to-end: shell.js's swap()
// catch returns before painting a fallback, and wireErrorBar filters the
// AbortError at the error/unhandledrejection hooks — the errbar stays hidden.
import { test, expect } from "@playwright/test";
import { FIXTURE } from "../../lib/harness.js";

test("navigating away mid-mount aborts the slow view silently — no errbar, next view intact", async ({ page }) => {
  await page.goto(`${FIXTURE}#/home`);
  await expect(page.getByTestId("msg")).toHaveText("Home OK");

  await page.getByRole("link", { name: "Slow" }).click(); // starts a 3s mount
  // Wait on the DOM, not a fixed sleep (reference/testing.md): the slow view
  // paints a synchronous "loading" marker before its 3s timer, so this proves
  // navigating away actually lands mid-mount instead of racing the click.
  await expect(page.getByTestId("slowLoading")).toBeVisible();

  await page.getByRole("link", { name: "Home" }).click(); // cancels it well before it resolves

  await expect(page.getByTestId("msg")).toHaveText("Home OK"); // the second view mounted intact
  await expect(page.locator("#errbar")).toBeHidden(); // no phantom AbortError painted
});
