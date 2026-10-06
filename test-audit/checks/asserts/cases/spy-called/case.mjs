// Interaction-only: only the spy call is checked, never what it produced.
// Source: Martin Fowler, Mocks Aren't Stubs (2007).
//   https://martinfowler.com/articles/mocksArentStubs.html
test("notifies the listener", () => {
  const spy = mock(notify);
  publish(event);
  expect(spy).toHaveBeenCalled();
});
