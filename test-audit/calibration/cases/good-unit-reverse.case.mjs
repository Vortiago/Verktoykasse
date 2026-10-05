// A real unit guard: a literal expected value.
test("reverses a string", () => {
  expect(reverse("abc")).toBe("cba");
});
