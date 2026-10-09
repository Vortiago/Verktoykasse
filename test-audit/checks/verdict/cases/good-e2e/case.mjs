// An end-to-end guard through the public interface.
// Source: Kent Beck, Test Desiderata (2019): Behavioral, Specific.
//   https://kentbeck.github.io/TestDesiderata/
test("the server answers health", async () => {
  const res = await fetch(base + "/health");
  expect(await res.text()).toBe("ok");
});
