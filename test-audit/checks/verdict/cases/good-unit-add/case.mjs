// A real unit guard: a literal expected value on the output.
// Source: Kent Beck, Test Desiderata (2019): Behavioral, Specific.
//   https://kentbeck.github.io/TestDesiderata/
test("add handles negatives", () => {
  expect(add(-2, -3)).toBe(-5);
});
