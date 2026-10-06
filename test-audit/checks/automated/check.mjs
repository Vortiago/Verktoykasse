// The automated check: does the test reach pass or fail with no person doing or
// reading anything? A "no" raises the `manual` flag.

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
    { name: "Kent Beck, Test Desiderata (Automated)", url: "https://kentbeck.github.io/TestDesiderata/" },
    { name: "Meszaros, xUnit Test Patterns: Manual Intervention", url: "http://xunitpatterns.com/" },
    { name: "Web Platform Tests, Review Checklist, on manual tests", url: "https://web-platform-tests.org/reviewing-tests/checklist.html" },
  ],
};
