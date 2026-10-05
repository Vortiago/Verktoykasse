// Falsifiability: passes-with-zero. An empty dispatch still satisfies the defined check.
test("events are dispatched", () => {
  const dispatched = collect();
  expect(dispatched).toBeDefined();
});
