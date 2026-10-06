// Several fields of one result are one behaviour.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Eager Test (in Obscure Test and Assertion Roulette).
//   http://xunitpatterns.com/Obscure%20Test.html
test("a new job starts queued with no steps", () => {
  expect(buildJob({ name: "nightly" })).toEqual({ name: "nightly", status: "queued", steps: [] });
});
