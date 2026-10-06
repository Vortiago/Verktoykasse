// A test that builds everything it reads.
// Source: Kent Beck, Test Desiderata (2019): Isolated.
//   https://kentbeck.github.io/TestDesiderata/
test("counts the words in a sentence", () => {
  expect(wordCount("a b c")).toBe(3);
});
