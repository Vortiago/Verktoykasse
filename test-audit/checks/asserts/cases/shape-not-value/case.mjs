// Catalogue: shape-not-value. The shape is checked, the content is not.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Shape-not-value.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("planner returns roads", () => {
  const roads = plan();
  expect(Array.isArray(roads)).toBe(true);
  expect(roads.length).toBe(3);
});
