// Catalogue: passes for the wrong reason. Only the mock call is checked.
test("saves the user", () => {
  const spy = mock(saveUser);
  save(user);
  expect(spy).toHaveBeenCalled();
});
