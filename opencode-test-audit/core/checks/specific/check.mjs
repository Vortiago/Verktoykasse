// canonical source: test-audit/checks/specific/check.mjs@9ae1caa sha256:3a0b049a6834eb6b2a77f13270b5a4cad5b986c5426a0186c314ca9b5563b898 - vendored copy, do not edit here
// The specific check: does an exact matcher pin the expected value, not a weak
// form (defined, truthy, a type, a length, a bound) that also passes on wrong
// output? A "no" raises the `weak-assert` flag.
//
// Sources:
// - Web Platform Tests, Review Checklist: "The test uses the most specific
//   asserts possible"
//   https://web-platform-tests.org/reviewing-tests/checklist.html
//   A reviewer asks for the strongest assertion that the check allows.
// - testsmells.org, Open Catalog of Test Smells: Sensitive Equality
//   https://testsmells.org/pages/testsmells.html
//   A comparison of a string form passes or fails for reasons other than the
//   value.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "specific",
  role: "descriptive",
  flag: "weak-assert",
  questions: {
    specific: noul(
      "Does the assertion pin the expected value with an exact matcher, such as toBe, toEqual, toStrictEqual, or toThrow with a message? Answer no when it uses a weak form that also passes on wrong output: toBeDefined, toBeTruthy, typeof, Array.isArray, a length, a bound such as toBeGreaterThan(0), or a boolean folded from a comparison.",
      "the assertion pins the expected value",
      "the assertion is a weak form that also passes on wrong output",
    ),
  },
  rubric: `Specific assertion: an exact matcher pins the expected value. Weak forms
  (toBeDefined, toBeTruthy, typeof, Array.isArray, a length, a bound, a folded
  boolean) pass on wrong output.`,
});
