// Falsifiability: vacuous. The aggregate exists, its content is never read.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Vacuous
//   / passes-with-zero.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("the summary is produced", () => {
  const summary = summarise(rows);
  expect(summary.totals).toBeDefined();
});
