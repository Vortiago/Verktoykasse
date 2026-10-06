// Defect: one-sided, only that the call does not throw is asserted and the
// output is never checked.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: No
//   negative/positive pair.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("parses a well formed header", () => {
  const run = () => parseHeader("content-length: 12");
  expect(run).not.toThrow();
});
