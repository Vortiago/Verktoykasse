// Defect: one-sided, only the empty result is asserted and no non-empty result is.
test("finds no imports in an empty file", () => {
  expect(findImports("")).toEqual([]);
});
