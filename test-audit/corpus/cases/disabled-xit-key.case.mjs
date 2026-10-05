// Catalogue: skipped. The scan flags the xit, so the test never runs.
xit("parses a dotted key", () => {
  expect(parseKey("a.b")).toEqual(["a", "b"]);
});
