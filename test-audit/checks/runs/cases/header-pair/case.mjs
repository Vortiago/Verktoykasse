// A skipped test beside a plain one: the skip stops only its own test.
// Source: testsmells.org, Open Catalog of Test Smells: Ignored Test.
//   https://testsmells.org/pages/testsmells.html
test.skip("rejects a malformed header", () => {
  expect(() => parseHeader("nope")).toThrow("missing colon");
});

test("parses a well formed header", () => {
  expect(parseHeader("content-length: 12")).toEqual({ "content-length": "12" });
});
