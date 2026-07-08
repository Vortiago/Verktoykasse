// Regression guard for the empty connectedMoveCallback() in lib/element.js.
//
// reconcileList reorders a live list with moveBefore() (Chromium 133+), which
// repositions a node WITHOUT resetting its state — but only if a custom element
// opts in with connectedMoveCallback. Without it, moving a <vc-*> fires
// disconnect+connect: disconnectedCallback aborts the mount and connectedCallback
// rebuilds from scratch, so a reconciled row silently loses its built subtree,
// listeners, focus and any in-flight state. This spec makes that failure visible.
import { test, expect } from "@playwright/test";

test("reconcileList moveBefore keeps a <vc-*> row's built subtree, focus and state", async ({ page }) => {
  await page.goto("/testing/fixtures/vc-reconcile.html");
  await page.waitForFunction(() => typeof (/** @type {any} */ (window)).__render === "function");

  // Hard precondition, not a skip: this Chrome/Edge-only skill pins a Chromium that
  // has moveBefore, and this spec's whole job is to fail when the state-preserving
  // move path breaks — a silent skip would let the guard quietly become a no-op.
  const supported = await page.evaluate(() => (/** @type {any} */ (window)).__supportsMove);
  expect(supported, "test browser must support Element.moveBefore").toBe(true);

  // Render four rows, wait for each <vc-button> to build its inner <button>.
  await page.evaluate(() => (/** @type {any} */ (window)).__render(["a", "b", "c", "d"]));
  await page.waitForFunction(() => (/** @type {any} */ (window)).__built());

  // Focus + stamp row "d"'s inner <button>, and remember that exact node.
  await page.evaluate(() => (/** @type {any} */ (window)).__mark("d"));

  // Reorder so "d" jumps to the front — reconcileList moves it via moveBefore.
  await page.evaluate(() => (/** @type {any} */ (window)).__render(["d", "a", "b", "c"]));

  const state = await page.evaluate(() => (/** @type {any} */ (window)).__probeState());
  expect(state.sameNode, "moved row keeps its built <button> node (no teardown+rebuild)").toBe(true);
  expect(state.stampKept, "JS state stamped on the built node survives the move").toBe(true);
  expect(state.connected, "the built node stays connected across the move").toBe(true);
  expect(state.focused, "focus is preserved across moveBefore (its headline promise)").toBe(true);

  // Sanity: the move actually happened (order changed, no row lost or duplicated).
  const order = await page.evaluate(() =>
    [...document.querySelectorAll("#list vc-button")].map((el) => el.getAttribute("data-key")));
  expect(order, "the row really moved to the front").toEqual(["d", "a", "b", "c"]);
});
