// An integration guard: a real store round trip.
test("store round trips a value", async () => {
  const store = await openStore(tmpdir());
  await store.set("k", "v");
  expect(await store.get("k")).toBe("v");
});
