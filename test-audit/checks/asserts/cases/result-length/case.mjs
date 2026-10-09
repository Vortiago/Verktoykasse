// Shape-only: the count of steps is checked, never which steps they are.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Shape-not-value.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("builds three steps", () => {
  const steps = planSteps(task);
  expect(steps.length).toBe(3);
});
