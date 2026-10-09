// A real guard: the test sorts its own input to get the expected order.
// Source: testsmells.org, Open Catalog of Test Smells: Redundant Assertion.
//   https://testsmells.org/pages/testsmells.html
test("orders the scores from low to high", () => {
  const scores = [7, 3, 9, 1];
  const expected = [...scores].sort((a, b) => a - b);
  expect(rank(scores)).toEqual(expected);
});
