// A real guard, but not deterministic: it waits on a timer.
test("debounce fires once", async () => {
  const calls = [];
  const debounced = debounce(() => calls.push(1), 20);
  debounced();
  await sleep(50);
  expect(calls.length).toBe(1);
});
