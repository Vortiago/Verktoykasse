// Defect: one-sided, only the absent lookup is asserted and no present lookup
// is.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: No
//   negative/positive pair.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("returns null for an unknown setting", () => {
  expect(readSetting({ theme: "dark" }, "font")).toBeNull();
});
