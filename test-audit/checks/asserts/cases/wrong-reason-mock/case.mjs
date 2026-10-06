// Catalogue: passes for the wrong reason. Only the mock call is checked.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Passes
//   for the wrong reason.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("saves the user", () => {
  const spy = mock(saveUser);
  save(user);
  expect(spy).toHaveBeenCalled();
});
