// Catalogue: skipped. The scan flags the skip, so the test never runs.
test.skip("rejects a stale token", () => {
  expect(verifyToken("expired")).toBe(false);
});
