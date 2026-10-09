// A test that changes an environment variable and leaves it changed.
// Source: Kent Beck, Test Desiderata (2019): Isolated.
//   https://kentbeck.github.io/TestDesiderata/
test("reads the port from the environment", () => {
  process.env.PORT = "8081";
  expect(portFromEnv()).toBe(8081);
});
