// Catalogue: skipped. The test is marked skip, so it never runs.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Skipped
//   / disabled / focused.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test.skip("rejects a stale token", () => {
  expect(verifyToken("expired")).toBe(false);
});
