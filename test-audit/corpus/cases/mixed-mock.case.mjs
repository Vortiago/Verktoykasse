// Mixed: an interaction assertion with a specific count.
test("retries once", () => {
  const fn = mock(flakyOperation);
  retry(fn);
  expect(fn).toHaveBeenCalledTimes(2);
});
