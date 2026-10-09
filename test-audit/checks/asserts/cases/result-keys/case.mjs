// Shape-only: the keys of the profile are checked, never their values.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Shape-not-value.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("loads the profile fields", () => {
  const profile = loadProfile(id);
  expect(Object.keys(profile)).toEqual(["name", "email", "age"]);
});
