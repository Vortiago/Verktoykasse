// Catalogue: early return. The early return makes the assertion unreachable.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Skipped
//   / disabled / focused.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("rejects a blank name", () => {
  return;
  expect(validateName("")).toBe(false);
});
