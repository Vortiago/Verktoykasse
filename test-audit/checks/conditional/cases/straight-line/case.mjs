// A test whose single assertion always runs.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Conditional Test Logic.
//   http://xunitpatterns.com/Conditional%20Test%20Logic.html
test("capitalises the first letter", () => {
  expect(capitalise("ada")).toBe("Ada");
});
