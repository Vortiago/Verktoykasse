// The specific check: does the test use the strongest assertion that would catch
// the failure, not a weaker one that also passes on wrong output? A "no" raises
// the `weak-assert` flag.
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
      "Does the test use the most specific assertion that would catch the failure, rather than a weaker one that would also pass on wrong output?",
      "the assertion is specific to the expected value",
      "a weaker assertion would also pass on wrong output",
    ),
  },
  rubric: `Specific assertion: the strongest assertion that would catch the failure. Weaker
  forms (toBeDefined, toBeTruthy, typeof, Array.isArray, a length) pass on wrong output.`,
  sources: [
    { name: "Web Platform Tests, Review Checklist: \"The test uses the most specific asserts possible\"", url: "https://web-platform-tests.org/reviewing-tests/checklist.html" },
    { name: "testsmells.org, Open Catalog of Test Smells: Sensitive Equality", url: "https://testsmells.org/pages/testsmells.html" },
  ],
});
