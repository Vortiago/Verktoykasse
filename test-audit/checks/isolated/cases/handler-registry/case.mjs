// Two tests share one registry that the file declares: the second test reads
// what the first one set.
// Source: Kent Beck, Test Desiderata (2019): Isolated.
//   https://kentbeck.github.io/TestDesiderata/
const registry = new Registry();

test("registers a handler", () => {
  registry.add("ping", () => "pong");
  expect(registry.dispatch("ping")).toBe("pong");
});

test("dispatches to the registered handler", () => {
  expect(registry.dispatch("ping")).toBe("pong");
});
