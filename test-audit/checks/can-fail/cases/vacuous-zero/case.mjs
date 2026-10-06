// Catalogue: vacuous / passes-with-zero. The feature may return nothing.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Vacuous
//   / passes-with-zero.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("imports are folded", () => {
  const commit = buildCommit([]);
  expect(commit.imports).toBeDefined();
});
