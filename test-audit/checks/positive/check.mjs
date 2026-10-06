// The positive check: does the test assert at least one output that must exist?
// A test that checks only an absence, an empty result, or a non-throw passes for
// code that does nothing. Asked as a twin pair; `positive_b` is the negated twin.
//
// The twin rule and its sources are in classifier/verdict.mjs.
//
// Sources:
// - the house catalogue, verify-prd-implemented/test-patterns.md: No
//   negative/positive pair
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
//   Only-negative tests pass against a resolver that always returns null. At
//   least one positive assertion is necessary.
// - Web Platform Tests, Review Checklist: "The test fails when it's supposed to
//   fail"
//   https://web-platform-tests.org/reviewing-tests/checklist.html
//   A reviewer checks that the test goes red when the code is wrong.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "positive",
  role: "gate",
  reason: "no positive assertion",
  questions: {
    positive_a: noul(
      "Does this test assert at least one output that the code under test must produce?",
      "it asserts an output that must be present",
      "it asserts only that something is absent, empty, or does not throw",
    ),
    // The negated twin of `positive_a`.
    positive_b: noul(
      "Do all the assertions in this test check only that something is absent, empty, or did not throw?",
      "it asserts only an absence, an empty result, or a non-throw",
      "at least one assertion checks an output that must be present",
    ),
  },
  negated: ["positive_b"],
  rubric: `Positive assertion: the test asserts the behaviour that must exist, not only
  that something is absent, empty, or does not throw.`,
  sources: [
    { name: "the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair", url: "https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md" },
    { name: "Web Platform Tests, Review Checklist: \"The test fails when it's supposed to fail\"", url: "https://web-platform-tests.org/reviewing-tests/checklist.html" },
  ],
};
