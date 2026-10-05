// Defect: one-sided, only the absent lookup is asserted and no present lookup is.
test("returns null for an unknown setting", () => {
  expect(readSetting({ theme: "dark" }, "font")).toBeNull();
});
