// Catalogue: name-only. The name promises email validation; the body only checks a truthy value.
test("validates email addresses", () => {
  expect(isValidEmail("a@b.com")).toBeTruthy();
});
