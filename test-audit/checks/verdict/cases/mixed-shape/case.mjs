// Mixed: two shape assertions, neither on the value the code produces.
test("builds the graph", () => {
  const graph = build();
  expect(Array.isArray(graph.nodes)).toBe(true);
  expect(graph.nodes.length).toBeGreaterThan(0);
});
