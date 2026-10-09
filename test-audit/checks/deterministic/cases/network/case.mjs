// Non-deterministic: the assertion depends on a live network fetch.
// Source: Kent Beck, Test Desiderata (2019): Deterministic.
//   https://kentbeck.github.io/TestDesiderata/
test("the remote catalogue lists the widget", async () => {
  const response = await fetch("https://example.test/catalogue");
  const items = await response.json();
  expect(items).toContain("widget");
});
