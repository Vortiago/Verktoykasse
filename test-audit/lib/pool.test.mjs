// Unit test for the bounded concurrency helper.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPool } from "./pool.mjs";

test("mapPool preserves input order", async () => {
  const slowFirst = (item) => new Promise((resolve) => setTimeout(() => resolve(item * 2), item === 1 ? 20 : 1));
  assert.deepEqual(await mapPool([1, 2, 3, 4], 2, slowFirst), [2, 4, 6, 8]);
});

test("mapPool never runs more than the limit at once", async () => {
  let active = 0;
  let peak = 0;
  await mapPool([1, 2, 3, 4, 5, 6], 2, async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
  });
  assert.equal(peak <= 2, true);
});

test("mapPool handles an empty list", async () => {
  assert.deepEqual(await mapPool([], 3, async (x) => x), []);
});
