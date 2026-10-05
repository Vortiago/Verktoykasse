// Hardcoded-data: the expected object copies the table the code is built from.
test("taxes the standard rate", () => {
  const expected = { standard: 0.2 };
  expect(taxRates()).toEqual(expected);
});
