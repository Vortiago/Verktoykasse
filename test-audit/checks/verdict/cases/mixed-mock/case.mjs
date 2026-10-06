// Mixed: an interaction assertion with a specific count.
// Source: Xuezhi Wang et al., Self-Consistency Improves Chain of Thought
//   Reasoning (ICLR 2023).
//   https://arxiv.org/abs/2203.11171
test("retries once", () => {
  const fn = mock(flakyOperation);
  retry(fn);
  expect(fn).toHaveBeenCalledTimes(2);
});
