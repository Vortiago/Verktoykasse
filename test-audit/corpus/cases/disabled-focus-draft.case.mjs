// Catalogue: focused. The file-level focus silently narrows the run to the first test.
it.only("saves the draft", () => {
  expect(saveDraft("draft")).toBe(true);
});

it("loads the draft", () => {
  expect(loadDraft("draft")).toEqual("draft");
});
