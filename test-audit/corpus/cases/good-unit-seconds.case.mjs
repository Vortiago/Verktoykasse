// A real unit guard: a literal expected value on the output.
test("converts minutes to seconds", () => {
  expect(toSeconds(3)).toBe(180);
});
