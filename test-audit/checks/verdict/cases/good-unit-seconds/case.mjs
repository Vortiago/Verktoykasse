// A real unit guard: a literal expected value on the output.
// Source: Kent Beck, Test Desiderata (2019): Behavioral, Specific.
//   https://kentbeck.github.io/TestDesiderata/
test("converts minutes to seconds", () => {
  expect(toSeconds(3)).toBe(180);
});
