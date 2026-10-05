// A regression guard: the bug's exact symptom, as a literal.
test("regression #77: a trimmed name keeps its inner spaces", () => {
  expect(trimName("  Ada  Lovelace  ")).toBe("Ada  Lovelace");
});
