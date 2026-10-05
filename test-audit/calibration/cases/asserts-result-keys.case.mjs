// Shape-only: the keys of the profile are checked, never their values.
test("loads the profile fields", () => {
  const profile = loadProfile(id);
  expect(Object.keys(profile)).toEqual(["name", "email", "age"]);
});
