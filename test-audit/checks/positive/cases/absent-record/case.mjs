// Defect: passes for the wrong reason, the queried record is absent because the
// fixture never created it.
// Source: the house catalogue, verify-prd-implemented/test-patterns.md: Passes
//   for the wrong reason.
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
test("reports no booking for a free slot", () => {
  const calendar = new Calendar();
  expect(calendar.bookingAt("2026-11-01T09:00")).toBeNull();
});
