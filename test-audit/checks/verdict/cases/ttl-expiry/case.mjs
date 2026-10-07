// A test that injects its own clock.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Resource Optimism (in Erratic Test).
//   http://xunitpatterns.com/Erratic%20Test.html
test("a token expires after its time to live", () => {
  const token = issueToken({ ttlMs: 500, now: () => 1_000 });
  expect(token.expiresAt).toBe(1_500);
});
