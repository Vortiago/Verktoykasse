// An end-to-end guard through the public interface.
test("the server answers health", async () => {
  const res = await fetch(base + "/health");
  expect(await res.text()).toBe("ok");
});
