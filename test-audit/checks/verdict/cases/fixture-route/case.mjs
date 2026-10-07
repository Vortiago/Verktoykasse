// Both the input and the expected value come from a test fixture module the
// reader cannot see here.
// Source: Kent Beck, Test Desiderata (2019): Readable.
//   https://kentbeck.github.io/TestDesiderata/
import { FIXTURE_REQUEST, EXPECTED_ROUTE } from "./fixtures/routes.mjs";

test("resolves the route of a request", () => {
  expect(resolveRoute(FIXTURE_REQUEST)).toEqual(EXPECTED_ROUTE);
});
