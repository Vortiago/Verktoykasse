// Defect: one-sided, only that the call does not throw is asserted and the output is never checked.
test("parses a well formed header", () => {
  const run = () => parseHeader("content-length: 12");
  expect(run).not.toThrow();
});
