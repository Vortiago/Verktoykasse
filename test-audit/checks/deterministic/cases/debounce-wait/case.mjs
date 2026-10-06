// Fake timers put the test in control of time, so it is deterministic.
// Source: Kent Beck, Test Desiderata (2019): Deterministic.
//   https://kentbeck.github.io/TestDesiderata/
test("debounce fires once after the wait", () => {
  vi.useFakeTimers();
  const calls = [];
  const debounced = debounce(() => calls.push(1), 20);
  debounced();
  debounced();
  vi.advanceTimersByTime(20);
  expect(calls).toEqual([1]);
  vi.useRealTimers();
});
