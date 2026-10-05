// Catalogue: no positive/negative pair. Passes against a resolver that always returns null.
test("no edge for a comment", () => {
  expect(resolveEdges("// comment")).toBeNull();
});
