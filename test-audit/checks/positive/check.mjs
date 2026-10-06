// The positive check: does at least one assertion name a value the code must
// produce, such as a literal, an object, or a thrown error with its message? A
// test that checks only null, undefined, empty, or a non-throw passes for
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

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "positive",
  role: "gate",
  reason: "no positive assertion",
  questions: {
    positive_a: noul(
      "Does at least one assertion name a value that the code under test must produce, such as a literal, an object, a thrown error with its message, or the true or false result the name asks for?",
      "at least one assertion names a value that must be produced",
      "every assertion checks only that something is null, undefined, empty, or did not throw",
    ),
    // The negated twin of `positive_a`.
    positive_b: noul(
      "Does every assertion in this test check only that something is null, undefined, empty, or did not throw?",
      "every assertion checks only that something is null, undefined, empty, or did not throw",
      "at least one assertion names a value that must be produced",
    ),
  },
  negated: ["positive_b"],
  rubric: `Positive assertion: at least one assertion names a value the code must produce,
  such as a literal, an object, or a thrown error with its message. A test that
  checks only null, undefined, empty, or no throw has none.`,
});
