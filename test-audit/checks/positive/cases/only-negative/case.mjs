// Catalogue: no positive/negative pair. Passes against a resolver that always
// returns null.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: No
//   negative/positive pair.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("no edge for a comment", () => {
  expect(resolveEdges("// comment")).toBeNull();
});
