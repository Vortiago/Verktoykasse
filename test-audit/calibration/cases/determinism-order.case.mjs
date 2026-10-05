// Non-deterministic: it asserts the key order of a structure that does not promise one.
test("the metric keys keep their insertion order", () => {
  const metrics = collectMetrics({ z: 1, a: 2 });
  expect(Object.keys(metrics)).toEqual(["z", "a"]);
});
