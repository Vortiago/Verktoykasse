// A test inside a skipped describe: the skip on the block stops it.
// Source: testsmells.org, Open Catalog of Test Smells: Ignored Test.
//   https://testsmells.org/pages/testsmells.html
describe.skip("legacy parser", () => {
  test("splits a dotted key", () => {
    expect(parseKey("a.b")).toEqual(["a", "b"]);
  });
});
