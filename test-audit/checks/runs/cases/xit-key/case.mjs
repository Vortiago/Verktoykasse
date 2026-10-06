// Catalogue: skipped. The test is marked xit, so it never runs.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Skipped
//   / disabled / focused.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
xit("parses a dotted key", () => {
  expect(parseKey("a.b")).toEqual(["a", "b"]);
});
