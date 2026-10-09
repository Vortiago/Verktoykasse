// A literal whose meaning the test shows: the date is the input plus the named
// number of days.
// Source: testsmells.org, Open Catalog of Test Smells: Magic Number Test.
//   https://testsmells.org/pages/testsmells.html
test("an invoice falls due thirty days after it is issued", () => {
  const DUE_IN_DAYS = 30;
  expect(dueDate("2026-01-01", DUE_IN_DAYS)).toBe("2026-01-31");
});
