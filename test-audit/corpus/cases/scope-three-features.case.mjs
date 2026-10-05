// Eager: the setup builds three features and the body asserts on all three.
test("the pipeline parses, formats and lints", () => {
  const ast = parse("const x=1");
  const formatted = format(ast);
  const warnings = lint(ast);
  expect(ast.type).toBe("Program");
  expect(formatted).toBe("const x = 1;\n");
  expect(warnings).toEqual([]);
});
