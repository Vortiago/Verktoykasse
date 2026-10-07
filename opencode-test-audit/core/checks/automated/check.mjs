// canonical source: test-audit/checks/automated/check.mjs@c34fea8 sha256:0f2e4ee16c3fbccb3235649e5c3a35ca0f37391e579c0d0820180465becfabae - vendored copy, do not edit here
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
      "Does this test pass or fail with no person acting or reading?",
      "yes: it checks itself",
      "no: a person must act or read its output",
    ),
  },
});
