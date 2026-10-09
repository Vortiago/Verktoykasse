// Defect: passes for the wrong reason, the asserted field is copied straight
// from the argument.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Passes
//   for the wrong reason.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("builds a job with the given name", () => {
  const job = buildJob({ name: "nightly", steps: [] });
  expect(job.name).toBe("nightly");
});
