// A seeded random source gives the same order on every run.
// Source: Kent Beck, Test Desiderata (2019): Deterministic.
//   https://kentbeck.github.io/TestDesiderata/
test("a seeded shuffle gives a fixed order", () => {
  const rng = seededRandom(42);
  expect(shuffle([1, 2, 3, 4], rng)).toEqual([3, 1, 4, 2]);
});
