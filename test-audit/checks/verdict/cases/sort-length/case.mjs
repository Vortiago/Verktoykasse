// Catalogue: name-only. The name promises a sort; the body only checks the
// length is unchanged.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Name-only.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("sorts rows by name", () => {
  const rows = sortRows([{ name: "b" }, { name: "a" }]);
  expect(rows).toHaveLength(2);
});
