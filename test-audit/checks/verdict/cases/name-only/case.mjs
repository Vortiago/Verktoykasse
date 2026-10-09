// Catalogue: name-only. The name promises a behaviour; the body asserts
// existence.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Name-only.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("computes the tax", () => {
  const tax = computeTax(100);
  expect(tax).toBeDefined();
});
