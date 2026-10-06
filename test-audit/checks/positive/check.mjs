// The positive check: does the test assert at least one output that must exist?
// A test that checks only an absence, an empty result, or a non-throw passes for
// code that does nothing. Asked as a twin pair; `positive_b` is the negated twin.

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
    { name: "the house catalogue: no negative/positive pair", url: "https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md" },
    { name: "Web Platform Tests, Review Checklist: \"The test fails when it's supposed to fail\"", url: "https://web-platform-tests.org/reviewing-tests/checklist.html" },
    { name: "Wang et al., Self-Consistency Improves Chain of Thought Reasoning (2023), for the twin", url: "https://arxiv.org/abs/2203.11171" },
  ],
};
