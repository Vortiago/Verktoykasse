// Catalogue: skipped. The test never runs.
test.skip("handles overflow", () => {
  expect(add(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER + 1);
});
