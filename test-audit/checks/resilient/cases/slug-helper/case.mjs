// A test that spies on an internal helper: renaming the helper breaks it,
// though the behaviour is the same.
// Source: Kent Beck, Test Desiderata (2019): Structure-insensitive.
//   https://kentbeck.github.io/TestDesiderata/
import * as internal from "../src/internal/normalise.mjs";

test("slugify lowercases through normalise", () => {
  const spy = vi.spyOn(internal, "normalise");
  expect(slugify("Hello World")).toBe("hello-world");
  expect(spy).toHaveBeenCalledWith("Hello World");
  spy.mockRestore();
});
