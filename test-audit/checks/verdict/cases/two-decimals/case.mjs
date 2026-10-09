// A test that does a tiny pure computation.
// Source: Kent Beck, Test Desiderata (2019): Fast.
//   https://kentbeck.github.io/TestDesiderata/
test("rounds to two decimals", () => {
  expect(round2(3.14159)).toBe(3.14);
});
