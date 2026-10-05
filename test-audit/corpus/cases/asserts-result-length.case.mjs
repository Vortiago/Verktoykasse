// Shape-only: the count of steps is checked, never which steps they are.
test("builds three steps", () => {
  const steps = planSteps(task);
  expect(steps.length).toBe(3);
});
