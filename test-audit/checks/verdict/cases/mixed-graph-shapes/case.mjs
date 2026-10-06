// Mixed: two shape assertions, neither on the value.
// Source: Xuezhi Wang et al., Self-Consistency Improves Chain of Thought
//   Reasoning (ICLR 2023).
//   https://arxiv.org/abs/2203.11171
test("collects the graph nodes", () => {
  const nodes = collect(graph);
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBeGreaterThan(0);
});
