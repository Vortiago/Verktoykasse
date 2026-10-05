// Catalogue: tautology / self-reference. Both sides call the same code.
test("reader round trips", () => {
  expect(parse(source)).toEqual(parse(source));
});
