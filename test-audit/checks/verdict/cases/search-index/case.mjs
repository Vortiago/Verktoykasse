// A test that reads a private field instead of what a caller can see.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Indirect Testing (in Obscure Test).
//   http://xunitpatterns.com/Obscure%20Test.html
test("indexes both words", () => {
  const engine = new SearchEngine(["apple", "pear"]);
  expect(engine._index).toEqual({ apple: [0], pear: [1] });
});
