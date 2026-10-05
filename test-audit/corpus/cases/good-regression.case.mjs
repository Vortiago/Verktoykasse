// A regression guard: the bug's exact symptom, as a literal.
test("regression #42: a single import resolves", () => {
  expect(parseImports('import a from "b";')).toEqual([{ name: "a", from: "b" }]);
});
