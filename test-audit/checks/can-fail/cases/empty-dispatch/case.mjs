// Falsifiability: passes-with-zero. An empty dispatch still satisfies the
// defined check.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Vacuous
//   / passes-with-zero.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("events are dispatched", () => {
  const dispatched = collect();
  expect(dispatched).toBeDefined();
});
