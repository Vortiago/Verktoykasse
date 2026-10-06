// The name-matches check: does the test body assert the behaviour its name
// states? A name-only test promises one behaviour and asserts something else or
// something trivial. A "no" raises the `name-mismatch` flag.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "name_matches",
  role: "descriptive",
  flag: "name-mismatch",
  questions: {
    name_matches: noul(
      "Does the test body assert the behaviour its name states?",
      "the body asserts the behaviour the name promises",
      "the name promises one behaviour and the body asserts something else or something trivial",
    ),
  },
  sources: [
    { name: "Web Platform Tests, Review Checklist: \"The test is testing what it thinks it's testing\"", url: "https://web-platform-tests.org/reviewing-tests/checklist.html" },
    { name: "testsmells.org, Open Catalog of Test Smells: Unknown Test", url: "https://testsmells.org/pages/testsmells.html" },
    { name: "Meszaros, xUnit Test Patterns: Obscure Test", url: "http://xunitpatterns.com/Obscure%20Test.html" },
    { name: "the house catalogue: name-only", url: "https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md" },
  ],
};
