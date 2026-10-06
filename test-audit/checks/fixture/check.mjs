// The fixture check: does the test, its hooks, or its setup build the data it
// reads, and no more? A value that nothing shown builds is a mystery guest. A
// "no" raises the
// `general-fixture` flag.
//
// Sources:
// - Gerard Meszaros, xUnit Test Patterns (2007): General Fixture, Irrelevant
//   Information (in Obscure Test)
//   http://xunitpatterns.com/Obscure%20Test.html
//   A large shared fixture, or data that the behaviour does not need, makes the
//   test hard to read.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "fixture",
  role: "descriptive",
  flag: "general-fixture",
  questions: {
    fixture: noul(
      "Does the test, or a hook in fixtures or code in setup, build the data the test reads, and no more? Answer no when the test reads a value that nothing shown builds, or when the fixture holds far more than the behaviour needs.",
      "it builds the data it reads, and only that",
      "it reads a value that nothing shown builds, or it leans on a fixture far larger than it needs",
    ),
  },
  rubric: `Local fixture: the test, its hooks, or its setup build the data it reads, and no
  more. A value that nothing shown builds is a mystery guest.`,
});
