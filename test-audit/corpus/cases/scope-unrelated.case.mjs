// Eager: one test checks validation, storage and notification in one body.
test("creating a user validates, stores and notifies", async () => {
  const store = new MemoryStore();
  const notifier = new SpyNotifier();
  const user = createUser(store, notifier, { name: "Ada" });
  expect(user.name).toBe("Ada");
  expect(await store.get(user.id)).toEqual(user);
  expect(notifier.sent).toHaveLength(1);
});
