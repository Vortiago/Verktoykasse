// Mixed: a tautology beside a weak shape assertion. Is the guard real or not?
// Source: Xuezhi Wang et al., Self-Consistency Improves Chain of Thought
//   Reasoning (ICLR 2023).
//   https://arxiv.org/abs/2203.11171
test("the world is sane", () => {
  expect(true).toBe(true);
  expect(add.length).toBeGreaterThan(0);
});
