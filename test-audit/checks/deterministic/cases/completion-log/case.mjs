// Two jobs run at once and log when they finish; the test pins an order that
// nothing guarantees.
// Source: Kent Beck, Test Desiderata (2019): Deterministic.
//   https://kentbeck.github.io/TestDesiderata/
test("both jobs report in start order", async () => {
  const log = [];
  await Promise.all([runJob("a", log), runJob("b", log)]);
  expect(log).toEqual(["a", "b"]);
});
