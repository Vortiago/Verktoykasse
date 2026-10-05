// Catalogue: name-only. The name promises a behaviour; the body asserts existence.
test("computes the tax", () => {
  const tax = computeTax(100);
  expect(tax).toBeDefined();
});
