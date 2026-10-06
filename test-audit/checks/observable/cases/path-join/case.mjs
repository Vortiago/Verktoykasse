// A test that asserts the return value, which a caller can see.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Indirect Testing (in Obscure Test).
//   http://xunitpatterns.com/Obscure%20Test.html
test("joins two path parts with a slash", () => {
  expect(joinPath(["a", "b"])).toBe("a/b");
});
