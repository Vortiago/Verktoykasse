// Falsifiability: self-reference. A call to the production code checks another
// call to it.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Tautology / self-reference.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("parse is stable", () => {
  expect(parse(src)).toEqual(parse(src));
});
