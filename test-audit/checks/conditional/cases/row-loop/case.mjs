// A loop over a result that may be empty: an empty result asserts nothing.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Conditional Test Logic.
//   http://xunitpatterns.com/Conditional%20Test%20Logic.html
test("every row is validated", () => {
  const rows = validateAll([{ id: 1 }, { id: 2 }]);
  for (const row of rows) expect(row.valid).toBe(true);
});
