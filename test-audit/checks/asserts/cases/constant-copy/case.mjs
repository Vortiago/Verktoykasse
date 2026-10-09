// Hardcoded-data: the expected table is the code's own constant, so the test
// agrees by construction.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Tautology / self-reference.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("taxes the standard rate", () => {
  expect(taxRates()).toEqual(TAX_RATES);
});