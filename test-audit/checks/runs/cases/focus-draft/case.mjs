// Catalogue: focused. The file-level focus silently narrows the run to the
// first test.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Skipped
//   / disabled / focused.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
it.only("saves the draft", () => {
  expect(saveDraft("draft")).toBe(true);
});

it("loads the draft", () => {
  expect(loadDraft("draft")).toEqual("draft");
});
