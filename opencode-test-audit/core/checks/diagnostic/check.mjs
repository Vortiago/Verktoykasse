// canonical source: test-audit/checks/diagnostic/check.mjs@4ba9d42 sha256:17627195b33adcc971c7a103cc64b09d3e933bc55237594ddffd85eb3c81b4a5 - vendored copy, do not edit here
// The diagnostic check: when the test fails, does it say which assertion failed
// and what was expected? A "no" raises the `silent-failure` flag.
//
// Sources:
// - Gerard Meszaros, xUnit Test Patterns (2007): Assertion Roulette (Missing
//   Assertion Message)
//   http://xunitpatterns.com/Assertion%20Roulette.html
//   When a test with several assertions fails, a missing message hides which
//   one failed.
// - testsmells.org, Open Catalog of Test Smells: Assertion Roulette
//   https://testsmells.org/pages/testsmells.html
//   Several assertions with no message make a failure hard to find.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "diagnostic",
  role: "descriptive",
  flag: "silent-failure",
  questions: {
    diagnostic: noul(
      "When this test fails, does it say which assertion failed and what was expected?",
      "the failure names the assertion and the expected value",
      "a failure gives no clue which assertion failed or why",
    ),
  },
  rubric: `Diagnostic: a failure names the assertion that failed and the expected value.`,
});
