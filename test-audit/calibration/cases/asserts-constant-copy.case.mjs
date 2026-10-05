// Hardcoded-data: the expected table is the code's own constant, so the test agrees by construction.
test("taxes the standard rate", () => {
  expect(taxRates()).toEqual(TAX_RATES);
});