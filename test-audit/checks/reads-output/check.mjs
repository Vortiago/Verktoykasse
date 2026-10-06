// The reads-output check: does the assertion read the value the code under test
// produced, not its own input, its setup, or only that no error was thrown? A
// "no" raises the `asserts-input` flag. A test that reads its input passes for
// the wrong reason, and only the mutation check proves that.
//
// Sources:
// - the house catalogue, verify-prd-implemented/test-patterns.md: Passes for
//   the wrong reason
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
//   The assertion can hold for a reason other than the code it claims to test.
//   Only the mutation check proves it.
// - Yue Jia and Mark Harman, An Analysis and Survey of the Development of
//   Mutation Testing (IEEE TSE 2011)
//   https://doi.org/10.1109/TSE.2010.62
//   A fault is found only when its effect reaches an output that the test
//   reads.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "reads_output",
  role: "descriptive",
  flag: "asserts-input",
  questions: {
    reads_output: noul(
      "Does the assertion read the value the code under test produced, rather than its own input, its setup, or only that no error was thrown?",
      "it asserts the returned or observed output",
      "it asserts its own input, its setup, or merely that the call did not throw",
    ),
  },
  rubric: `Asserts the output: the assertion reads the value the code under test produced,
  not its own input, its setup, or merely that no error was thrown.`,
  sources: [
    { name: "the house catalogue, verify-prd-implemented/test-patterns.md: Passes for the wrong reason", url: "https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md" },
    { name: "Yue Jia and Mark Harman, An Analysis and Survey of the Development of Mutation Testing (IEEE TSE 2011)", url: "https://doi.org/10.1109/TSE.2010.62" },
  ],
};
