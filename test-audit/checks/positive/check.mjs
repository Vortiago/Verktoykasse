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
      "Does an assertion need a value a do-nothing stub could not return?",
      "yes: a non-zero number, a non-empty string or object, true, or an error with its message",
      "no: only empty, zero, false, null, undefined, or no throw",
    ),
    positive_b: noul(
      "Does this test fail against a stub that returns nothing and never throws?",
      "yes: an assertion needs a real value",
      "no: it passes an empty or null result",
    ),
  },
  negated: [],
});
