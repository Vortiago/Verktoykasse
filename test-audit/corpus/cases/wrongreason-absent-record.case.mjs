// Defect: passes for the wrong reason, the queried record is absent because the fixture never created it.
test("reports no booking for a free slot", () => {
  const calendar = new Calendar();
  expect(calendar.bookingAt("2026-11-01T09:00")).toBeNull();
});
