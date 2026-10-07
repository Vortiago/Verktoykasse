// A unit test: one pure function, no collaborators.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy.
//   http://xunitpatterns.com/
test("adds two numbers", () => {
  expect(add(2, 3)).toBe(5);
});
