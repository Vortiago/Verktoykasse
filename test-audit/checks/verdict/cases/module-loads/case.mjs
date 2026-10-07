// A smoke test: it checks only that the entry module loads.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy.
//   http://xunitpatterns.com/
test("the package entry loads", async () => {
  await expect(import("../src/index.mjs")).resolves.toBeDefined();
});
