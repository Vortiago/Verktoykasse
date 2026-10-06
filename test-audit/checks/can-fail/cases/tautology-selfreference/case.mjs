// Catalogue: tautology / self-reference. Both sides call the same code.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Tautology / self-reference.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("reader round trips", () => {
  expect(parse(source)).toEqual(parse(source));
});
