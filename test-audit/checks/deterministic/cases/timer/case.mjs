// Non-deterministic: the assertion races a fixed sleep instead of awaiting the
// retry.
// Source: Kent Beck, Test Desiderata (2019): Deterministic.
//   https://kentbeck.github.io/TestDesiderata/
test("the retry lands within the window", async () => {
  const attempts = [];
  retryOnFailure(() => attempts.push(1));
  await sleep(50);
  expect(attempts.length).toBe(2);
});
