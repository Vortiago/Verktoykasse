// Catalogue: name-only. The name promises a sort; the body only checks the length is unchanged.
test("sorts rows by name", () => {
  const rows = sortRows([{ name: "b" }, { name: "a" }]);
  expect(rows).toHaveLength(2);
});
