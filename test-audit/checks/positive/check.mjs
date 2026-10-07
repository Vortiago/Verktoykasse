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
      "Does at least one assertion expect a non-empty value?",
      "at least one expects a non-empty value",
      "every assertion expects empty, null, undefined, or no throw",
    ),
    positive_b: noul(
      "Does every assertion expect only empty, null, undefined, or no throw?",
      "every assertion expects empty, null, undefined, or no throw",
      "at least one expects a non-empty value",
    ),
  },
  negated: ["positive_b"],
  rubric: `Positive assertion: at least one assertion expects a non-empty value the code
  must produce, such as a literal, an object, a true or false result, or a thrown
  error with its message. Empty means [], "", {}, null, or undefined, also when
  written as a literal such as toEqual([]). A test that expects only empty values
  or no throw has none.`,
});
