// The diagnostic check: when the test fails, does it say which assertion failed
// and what was expected? A "no" raises the `silent-failure` flag.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
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
  sources: [
    { name: "Meszaros, xUnit Test Patterns: Assertion Roulette (Missing Assertion Message)", url: "http://xunitpatterns.com/Assertion%20Roulette.html" },
    { name: "testsmells.org, Open Catalog of Test Smells: Assertion Roulette", url: "https://testsmells.org/pages/testsmells.html" },
  ],
};
