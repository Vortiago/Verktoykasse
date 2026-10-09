// A test that changes an environment variable and an after hook that puts it
// back.
// Source: Kent Beck, Test Desiderata (2019): Isolated.
//   https://kentbeck.github.io/TestDesiderata/
const previous = process.env.PORT;

afterEach(() => {
  process.env.PORT = previous;
});

test("reads the port from the environment", () => {
  process.env.PORT = "8081";
  expect(portFromEnv()).toBe(8081);
});
