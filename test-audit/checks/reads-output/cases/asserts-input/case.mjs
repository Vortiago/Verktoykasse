// Defect: passes for the wrong reason, the assertion reads the input instead of
// the returned value.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Passes
//   for the wrong reason.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("normalise keeps the title text", () => {
  const input = { title: "  hello  " };
  normalise(input);
  expect(input.title).toBe("  hello  ");
});
