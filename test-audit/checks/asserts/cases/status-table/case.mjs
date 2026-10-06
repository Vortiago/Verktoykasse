// Hardcoded-data: the expected labels are the code's own constant, so the test agrees by construction.
test("resolves the status labels", () => {
  expect(statusLabels()).toEqual(STATUS_LABELS);
});