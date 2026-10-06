// The automated check: does the test reach pass or fail with no person doing or
// reading anything? A "no" raises the `manual` flag.
//
// Sources:
// - Kent Beck, Test Desiderata (2019): Automated
//   https://kentbeck.github.io/TestDesiderata/
//   A test runs without human intervention.
// - Gerard Meszaros, xUnit Test Patterns (2007): Manual Intervention
//   http://xunitpatterns.com/
//   A test that needs a person to set it up or to check the result is not a
//   self-checking test.
// - Web Platform Tests, Review Checklist: manual tests
//   https://web-platform-tests.org/reviewing-tests/checklist.html
//   The checklist keeps manual tests apart from automated tests.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "automated",
  role: "descriptive",
  flag: "manual",
  questions: {
    automated: noul(
      "Does this test reach a pass or fail with no person doing or reading anything?",
      "it is self-checking and unattended",
      "it needs a manual step, or a person to read the output",
    ),
  },
  rubric: `Automated: the test reaches pass or fail with no person doing or reading anything.`,
  sources: [
    { name: "Kent Beck, Test Desiderata (2019): Automated", url: "https://kentbeck.github.io/TestDesiderata/" },
    { name: "Gerard Meszaros, xUnit Test Patterns (2007): Manual Intervention", url: "http://xunitpatterns.com/" },
    { name: "Web Platform Tests, Review Checklist: manual tests", url: "https://web-platform-tests.org/reviewing-tests/checklist.html" },
  ],
};
