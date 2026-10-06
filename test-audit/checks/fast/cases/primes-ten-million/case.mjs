// A test that computes over a large input.
// Source: Kent Beck, Test Desiderata (2019): Fast.
//   https://kentbeck.github.io/TestDesiderata/
test("finds the largest prime below ten million", () => {
  expect(primesBelow(10_000_000).at(-1)).toBe(9_999_991);
});
