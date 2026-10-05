// Falsifiability: vacuous. The aggregate exists, its content is never read.
test("the summary is produced", () => {
  const summary = summarise(rows);
  expect(summary.totals).toBeDefined();
});
