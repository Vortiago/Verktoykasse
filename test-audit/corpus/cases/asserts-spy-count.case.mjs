// Interaction-only: the call count is checked, never the payload sent.
test("publishes twice", () => {
  const spy = mock(publish);
  runBatch(items);
  expect(spy).toHaveBeenCalledTimes(2);
});
