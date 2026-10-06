// Interaction-only: the mock argument shape is checked, never the real output.
// Source: Martin Fowler, Mocks Aren't Stubs (2007).
//   https://martinfowler.com/articles/mocksArentStubs.html
test("forwards the payload", () => {
  const spy = mock(send);
  dispatch(message);
  expect(spy.mock.calls[0][0]).toMatchObject({ id: expect.any(String) });
});
