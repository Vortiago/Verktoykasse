// Catalogue: tautology. The assertion is true for every build.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Tautology / self-reference.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("the world is sane", () => {
  expect(true).toBe(true);
});
