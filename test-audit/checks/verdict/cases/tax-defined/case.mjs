// Catalogue: name-only. The name promises a tax value; the body only checks
// that one exists.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Name-only.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("computes the tax due", () => {
  const tax = computeTax(100);
  expect(tax).toBeDefined();
});
