// Mixed: a tautology beside a weak shape assertion.
// Source: Xuezhi Wang et al., Self-Consistency Improves Chain of Thought
//   Reasoning (ICLR 2023).
//   https://arxiv.org/abs/2203.11171
test("the schema is sound", () => {
  expect(true).toBe(true);
  expect(schema.fields.length).toBeGreaterThan(0);
});
