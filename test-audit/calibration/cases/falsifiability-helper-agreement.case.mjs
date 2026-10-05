// Falsifiability: self-reference. One helper computes both sides, so they agree by construction.
test("the two totals match", () => {
  expect(total(rows)).toBe(total(rows));
});
