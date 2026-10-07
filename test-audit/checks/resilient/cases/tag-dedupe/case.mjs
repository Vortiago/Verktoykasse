// A test that reaches the code only through its public function.
// Source: Kent Beck, Test Desiderata (2019): Structure-insensitive.
//   https://kentbeck.github.io/TestDesiderata/
test("removes duplicate tags", () => {
  expect(dedupe(["a", "b", "a"])).toEqual(["a", "b"]);
});
