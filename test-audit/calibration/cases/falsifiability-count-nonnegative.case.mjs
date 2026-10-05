// Falsifiability: vacuous. A length is never negative, so the bound is always true.
test("the queue is not negative", () => {
  expect(queue.length).toBeGreaterThanOrEqual(0);
});
