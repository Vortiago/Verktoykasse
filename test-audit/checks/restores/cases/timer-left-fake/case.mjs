// A test that fakes the timers and never restores them.
// Source: Kent Beck, Test Desiderata (2019): Isolated.
//   https://kentbeck.github.io/TestDesiderata/
test("the reminder fires after an hour", () => {
  vi.useFakeTimers();
  const fired = [];
  scheduleReminder(() => fired.push("reminder"), 3_600_000);
  vi.advanceTimersByTime(3_600_000);
  expect(fired).toEqual(["reminder"]);
});
