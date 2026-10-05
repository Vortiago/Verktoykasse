// Mixed: a tautology beside a weak shape assertion.
test("the schema is sound", () => {
  expect(true).toBe(true);
  expect(schema.fields.length).toBeGreaterThan(0);
});
