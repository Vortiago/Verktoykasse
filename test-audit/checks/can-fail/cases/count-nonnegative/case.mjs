// Falsifiability: vacuous. A length is never negative, so the bound is always
// true.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Vacuous
//   / passes-with-zero.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("the queue is not negative", () => {
  expect(queue.length).toBeGreaterThanOrEqual(0);
});
