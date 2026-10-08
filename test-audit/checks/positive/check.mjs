// The positive check: does at least one assertion need a value that a
// do-nothing stub could not return, such as a non-empty literal, an object, or a
// thrown error with its message? A test that checks only empty, zero, false,
// null, undefined, or a non-throw passes for code that does nothing. Asked as a
// twin pair of two plain phrasings.
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
      "Does an assertion expect a non-empty value?",
      "yes: a number, a string, true, an object, or an error message",
      "no: only empty, null, undefined, or no throw",
    ),
    positive_b: noul(
      "Does an assertion check a value that is not empty or null?",
      "yes: it checks a real value",
      "no: only empty, null, undefined, or no throw",
    ),
  },
  negated: [],
});
