// Non-deterministic: the input is drawn with Math.random, so a failure is not reproducible.
test("the sorter keeps every random value", () => {
  const input = Array.from({ length: 5 }, () => Math.floor(Math.random() * 100));
  expect(sortNumbers(input)).toEqual([...input].sort((a, b) => a - b));
});
