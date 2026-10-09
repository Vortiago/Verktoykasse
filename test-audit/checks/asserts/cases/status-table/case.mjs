// Hardcoded-data: the expected labels are the code's own constant, so the test
// agrees by construction.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Tautology / self-reference.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("resolves the status labels", () => {
  expect(statusLabels()).toEqual(STATUS_LABELS);
});