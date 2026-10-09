// A bound where an exact value is possible: a wrong major above zero passes.
// Source: Web Platform Tests, Review Checklist: "The test uses the most specific asserts possible".
//   https://web-platform-tests.org/reviewing-tests/checklist.html
test("reads the major version", () => {
  expect(parseVersion("1.2.3").major).toBeGreaterThan(0);
});
