// Hardcoded-data: the expected labels repeat the constant the code is built from.
test("resolves the status labels", () => {
  const labels = ["open", "closed"];
  expect(statusLabels()).toEqual(labels);
});
