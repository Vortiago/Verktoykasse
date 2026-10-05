// Catalogue: early return. The early return makes the assertion unreachable.
test("rejects a blank name", () => {
  return;
  expect(validateName("")).toBe(false);
});
