// Non-deterministic: the assertion reads the wall clock, so it depends on when
// it runs.
// Source: Kent Beck, Test Desiderata (2019): Deterministic.
//   https://kentbeck.github.io/TestDesiderata/
test("the token has not expired yet", () => {
  const token = issueToken({ ttlMs: 60_000 });
  expect(token.expiresAt).toBeGreaterThan(Date.now());
});
