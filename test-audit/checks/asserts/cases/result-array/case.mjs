// Shape-only: the result is an array, but no route in it is ever checked.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Shape-not-value.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("returns a list of routes", () => {
  const routes = routesFor(graph);
  expect(Array.isArray(routes)).toBe(true);
});
