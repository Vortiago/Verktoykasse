// A real guard: the expected value is a constant the test file declares,
// so it is fixed by the test, not taken from the code under test.
// Source: testsmells.org, Open Catalog of Test Smells: Magic Number Test.
//   https://testsmells.org/pages/testsmells.html
const EXPECTED = { major: 1, minor: 2, patch: 3 };

test("parses a semantic version", () => {
  expect(parseVersion("1.2.3")).toEqual(EXPECTED);
});
