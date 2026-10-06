// canonical source: test-audit/checks/automated/check.mjs@9ae1caa sha256:e53cb79f91620615c858c36ba5b5147b228a95493490598f81083c848b631408 - vendored copy, do not edit here
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

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "automated",
  role: "descriptive",
  flag: "manual",
  questions: {
    automated: noul(
      "Does this test reach a pass or fail with no person doing or reading anything?",
      "it is self-checking and unattended",
      "it has no assertion and only prints, or it waits for a person to act or to read its output",
    ),
  },
  rubric: `Automated: the test reaches pass or fail with no person doing or reading anything.`,
});
