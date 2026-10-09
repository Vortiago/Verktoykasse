// The input, the action, and the expected result are all in the body.
// Source: Kent Beck, Test Desiderata (2019): Readable.
//   https://kentbeck.github.io/TestDesiderata/
test("capitalises a lower case name", () => {
  expect(capitalise("ada")).toBe("Ada");
});
