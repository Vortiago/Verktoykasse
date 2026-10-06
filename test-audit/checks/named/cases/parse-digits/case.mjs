// A vague name on a sound test.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Obscure Test.
//   http://xunitpatterns.com/Obscure%20Test.html
test("works", () => {
  expect(parseNumber("42")).toBe(42);
});
