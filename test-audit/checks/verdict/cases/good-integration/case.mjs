// An integration guard: a real store round trip.
// Source: Kent Beck, Test Desiderata (2019): Behavioral, Specific.
//   https://kentbeck.github.io/TestDesiderata/
test("store round trips a value", async () => {
  const store = await openStore(tmpdir());
  await store.set("k", "v");
  expect(await store.get("k")).toBe("v");
});
