// An exact matcher pins the whole expected value.
// Source: Web Platform Tests, Review Checklist: "The test uses the most specific asserts possible".
//   https://web-platform-tests.org/reviewing-tests/checklist.html
test("splits a version into its parts", () => {
  expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
});
