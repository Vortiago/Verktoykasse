// A real unit guard: a literal expected value on the output.
test("add handles negatives", () => {
  expect(add(-2, -3)).toBe(-5);
});
