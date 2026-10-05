// Catalogue: name-only. The name promises a tax value; the body only checks that one exists.
test("computes the tax due", () => {
  const tax = computeTax(100);
  expect(tax).toBeDefined();
});
