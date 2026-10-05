// Mixed: two shape assertions, neither on the value.
test("collects the graph nodes", () => {
  const nodes = collect(graph);
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBeGreaterThan(0);
});
