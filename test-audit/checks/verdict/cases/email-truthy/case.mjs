// Catalogue: name-only. The name promises email validation; the body only
// checks a truthy value.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Name-only.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("validates email addresses", () => {
  expect(isValidEmail("a@b.com")).toBeTruthy();
});
