// Defect: passes for the wrong reason, the asserted field is copied straight from the argument.
test("builds a job with the given name", () => {
  const job = buildJob({ name: "nightly", steps: [] });
  expect(job.name).toBe("nightly");
});
