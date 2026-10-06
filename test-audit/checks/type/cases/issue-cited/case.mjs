// A regression test: the name cites the issue it keeps from returning.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy.
//   http://xunitpatterns.com/
test("regression #12: an empty list sums to zero", () => {
  expect(sum([])).toBe(0);
});
