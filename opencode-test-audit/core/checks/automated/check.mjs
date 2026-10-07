// canonical source: test-audit/checks/automated/check.mjs@45c4fac sha256:ed7d0e30d344ab54f587e14605bbf83f143be46172d7dfb67d4e130970f680d7 - vendored copy, do not edit here
// The automated check: does the test pass or fail with no person setting it up,
// acting, or reading? A "no" raises the `manual` flag.
//
// Sources:
// - Kent Beck, Test Desiderata (2019): Automated
//   https://kentbeck.github.io/TestDesiderata/
//   A test runs without human intervention.
// - Gerard Meszaros, xUnit Test Patterns (2007): Manual Intervention
//   http://xunitpatterns.com/Manual%20Intervention.html
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
      "Does this test pass or fail with no person involved?",
      "yes: no person must set up, act, or read",
      "no: a person must",
    ),
  },
});
