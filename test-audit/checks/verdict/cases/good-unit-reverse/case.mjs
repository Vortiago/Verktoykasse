// A real unit guard: a literal expected value.
// Source: Kent Beck, Test Desiderata (2019): Behavioral, Specific.
//   https://kentbeck.github.io/TestDesiderata/
test("reverses a string", () => {
  expect(reverse("abc")).toBe("cba");
});
