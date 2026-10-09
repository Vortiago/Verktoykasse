// A regression guard: the bug's exact symptom, as a literal.
// Source: Kent Beck, Test Desiderata (2019): Behavioral, Specific.
//   https://kentbeck.github.io/TestDesiderata/
test("regression #77: a trimmed name keeps its inner spaces", () => {
  expect(trimName("  Ada  Lovelace  ")).toBe("Ada  Lovelace");
});
