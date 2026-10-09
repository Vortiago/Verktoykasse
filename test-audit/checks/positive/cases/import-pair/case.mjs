// A real guard with a negative and a positive assertion: the empty case is
// checked beside a value that must be produced.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("finds the imports of a file", () => {
  expect(findImports("")).toEqual([]);
  expect(findImports('import a from "b";')).toEqual([{ name: "a", from: "b" }]);
});
