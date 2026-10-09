// A real unit guard: a literal string on the output.
// Source: Kent Beck, Test Desiderata (2019): Behavioral, Specific.
//   https://kentbeck.github.io/TestDesiderata/
test("slugs a display name", () => {
  expect(slugify("Hello, World")).toBe("hello-world");
});
