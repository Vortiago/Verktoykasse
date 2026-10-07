// A test that reads a file it does not create, and assumes it is present.
// Source: Gerard Meszaros, xUnit Test Patterns (2007): Resource Optimism (in Erratic Test).
//   http://xunitpatterns.com/Erratic%20Test.html
import { readFileSync } from "node:fs";

test("reads the port from the sample file", () => {
  const text = readFileSync("fixtures/sample.ini", "utf8");
  expect(parseIni(text).port).toBe(8080);
});
