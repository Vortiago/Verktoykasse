// Mixed: a tautology beside a weak shape assertion. Is the guard real or not?
test("the world is sane", () => {
  expect(true).toBe(true);
  expect(add.length).toBeGreaterThan(0);
});
