// A real unit guard: a literal string on the output.
test("slugs a display name", () => {
  expect(slugify("Hello, World")).toBe("hello-world");
});
