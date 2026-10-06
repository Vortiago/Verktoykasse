// canonical source: test-audit/checks/diagnostic/check.mjs@9ae1caa sha256:5b04124b669f40a42bf2fcfede4f81f1692ce91a3c37fb42d6dea3265eb61cb4 - vendored copy, do not edit here
// The diagnostic check: does a failure show the received and the expected value?
// A bare boolean check, or one assertion repeated in a loop with no index, does
// not. A "no" raises the `silent-failure` flag.
//
// Sources:
// - Gerard Meszaros, xUnit Test Patterns (2007): Assertion Roulette (Missing
//   Assertion Message)
//   http://xunitpatterns.com/Assertion%20Roulette.html
//   When a test with several assertions fails, a missing message hides which
//   one failed.
// - testsmells.org, Open Catalog of Test Smells: Assertion Roulette
//   https://testsmells.org/pages/testsmells.html
//   Several assertions with no message make a failure hard to find.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "diagnostic",
  role: "descriptive",
  flag: "silent-failure",
  questions: {
    diagnostic: noul(
      "Does each assertion compare a value with a matcher that reports the expected and the received value, such as toBe or toEqual? A bare boolean check such as expect(a === b).toBe(true) or assert(ok), a comparison folded into one boolean, or one assertion repeated in a loop with no index hides which value was wrong.",
      "each failure shows the received value and the expected value",
      "a failure shows only true or false, or cannot say which value failed",
    ),
  },
  rubric: `Diagnostic: a failure shows the received and the expected value. A bare boolean
  check, or one assertion repeated in a loop with no index, does not.`,
});
