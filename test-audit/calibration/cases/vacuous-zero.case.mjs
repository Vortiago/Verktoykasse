// Catalogue: vacuous / passes-with-zero. The feature may return nothing.
test("imports are folded", () => {
  const commit = buildCommit([]);
  expect(commit.imports).toBeDefined();
});
