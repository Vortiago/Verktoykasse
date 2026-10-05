// Falsifiability: self-reference. A call to the production code checks another call to it.
test("parse is stable", () => {
  expect(parse(src)).toEqual(parse(src));
});
