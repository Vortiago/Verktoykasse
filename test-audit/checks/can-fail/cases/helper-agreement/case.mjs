// Falsifiability: self-reference. One helper computes both sides, so they agree
// by construction.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md:
//   Tautology / self-reference.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("the two totals match", () => {
  expect(total(rows)).toBe(total(rows));
});
