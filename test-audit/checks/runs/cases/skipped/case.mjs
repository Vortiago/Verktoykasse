// Catalogue: skipped. The test never runs.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Skipped
//   / disabled / focused.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test.skip("handles overflow", () => {
  expect(add(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER + 1);
});
