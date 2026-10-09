// A name that states the behaviour, without its expected result.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Obscure Test.
//   http://xunitpatterns.com/Obscure%20Test.html
test("parses a number", () => {
  expect(parseNumber("42")).toBe(42);
});
