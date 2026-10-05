// Catalogue: shape-not-value. The shape is checked, the content is not.
test("planner returns roads", () => {
  const roads = plan();
  expect(Array.isArray(roads)).toBe(true);
  expect(roads.length).toBe(3);
});
