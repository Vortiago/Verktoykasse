// A self-checking test: it reaches pass or fail on its own.
// Source: Kent Beck, Test Desiderata (2019): Automated.
//   https://kentbeck.github.io/TestDesiderata/
test("formats a date as ISO", () => {
  expect(formatDate(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05");
});
