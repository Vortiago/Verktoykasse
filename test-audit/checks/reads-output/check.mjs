// The reads-output check: does the assertion read the value the code under test
// produced, not its own input, its setup, or only that no error was thrown? A
// "no" raises the `asserts-input` flag. A test that reads its input passes for
// the wrong reason, and only the mutation check proves that.

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
    { name: "testsmells.org, Open Catalog of Test Smells: Assertion Diversion, Calculating Expected Results On The Fly", url: "https://testsmells.org/pages/testsmells.html" },
    { name: "the house catalogue: passes for the wrong reason", url: "https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md" },
    { name: "mutation-testing propagation: Jia and Harman, An Analysis and Survey of the Development of Mutation Testing (2011)", url: "https://doi.org/10.1109/TSE.2010.62" },
  ],
};
