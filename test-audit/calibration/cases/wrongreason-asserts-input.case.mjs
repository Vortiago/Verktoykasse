// Defect: passes for the wrong reason, the assertion reads the input instead of the returned value.
test("normalise keeps the title text", () => {
  const input = { title: "  hello  " };
  normalise(input);
  expect(input.title).toBe("  hello  ");
});
