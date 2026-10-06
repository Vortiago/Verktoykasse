// An end-to-end guard through the public interface.
// Source: Kent Beck, Test Desiderata (2019): Behavioral, Specific.
//   https://kentbeck.github.io/TestDesiderata/
test("the service reports its version", async () => {
  const res = await fetch(base + "/version");
  expect(await res.text()).toBe("2.4.1");
});
