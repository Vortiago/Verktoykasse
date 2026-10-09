// Mixed: two shape assertions, neither on the value the code produces.
// Source: Xuezhi Wang et al., Self-Consistency Improves Chain of Thought
//   Reasoning (ICLR 2023).
//   https://arxiv.org/abs/2203.11171
test("builds the graph", () => {
  const graph = build();
  expect(Array.isArray(graph.nodes)).toBe(true);
  expect(graph.nodes.length).toBeGreaterThan(0);
});
