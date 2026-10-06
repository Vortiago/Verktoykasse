// Interaction-only: the call count is checked, never the payload sent.
// Source: Martin Fowler, Mocks Aren't Stubs (2007).
//   https://martinfowler.com/articles/mocksArentStubs.html
test("publishes twice", () => {
  const spy = mock(publish);
  runBatch(items);
  expect(spy).toHaveBeenCalledTimes(2);
});
