// Non-deterministic: the assertion reads the wall clock, so it depends on when it runs.
test("the token has not expired yet", () => {
  const token = issueToken({ ttlMs: 60_000 });
  expect(token.expiresAt).toBeGreaterThan(Date.now());
});
