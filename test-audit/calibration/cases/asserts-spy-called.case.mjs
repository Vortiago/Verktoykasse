// Interaction-only: only the spy call is checked, never what it produced.
test("notifies the listener", () => {
  const spy = mock(notify);
  publish(event);
  expect(spy).toHaveBeenCalled();
});
