// Shape-only: the result is an array, but no route in it is ever checked.
test("returns a list of routes", () => {
  const routes = routesFor(graph);
  expect(Array.isArray(routes)).toBe(true);
});
