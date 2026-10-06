// Defect: one-sided, only the empty result is asserted and no non-empty result
// is.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: No
//   negative/positive pair.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("finds no imports in an empty file", () => {
  expect(findImports("")).toEqual([]);
});
