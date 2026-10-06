// The fixture check: does the test build only the data it needs, not a large
// shared fixture or values unrelated to the behaviour? A "no" raises the
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
      "Does the test build only the data it needs, rather than a large shared fixture or values unrelated to the behaviour?",
      "it builds only the data it needs",
      "it leans on a large or unrelated fixture",
    ),
  },
  rubric: `Local fixture: the test builds only the data it needs, not a large shared fixture
  or values unrelated to the behaviour.`,
});
