// A test that waits for a person to paste a value.
// Source: Kent Beck, Test Desiderata (2019): Automated.
//   https://kentbeck.github.io/TestDesiderata/
import { readLine } from "./prompt.mjs";

test("accepts the token from the mail", async () => {
  const token = await readLine("paste the token from the mail: ");
  expect(verifyToken(token)).toBe(true);
});
