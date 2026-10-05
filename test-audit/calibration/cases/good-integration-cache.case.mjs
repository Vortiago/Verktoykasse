// An integration guard: a real cache round trip.
test("the cache returns a stored value", async () => {
  const cache = await openCache(tmpdir());
  await cache.put("session", "abc123");
  expect(await cache.get("session")).toBe("abc123");
});
