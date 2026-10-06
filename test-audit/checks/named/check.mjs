// The named check: does the test's name state the behaviour it checks, not a
// vague label? A "no" raises the `vague-name` flag.
//
// Sources:
// - Gerard Meszaros, xUnit Test Patterns (2007): Obscure Test
//   http://xunitpatterns.com/Obscure%20Test.html
//   A reader cannot tell what the test verifies.
// - testsmells.org, Open Catalog of Test Smells: Unknown Test
//   https://testsmells.org/pages/testsmells.html
//   A test that does not show what it verifies hides its purpose.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "named",
  role: "descriptive",
  flag: "vague-name",
  questions: {
    named: noul(
      "Does the test's name state the behaviour it checks, rather than a vague label such as works, test1, should be fine, or only the name of the unit, such as add or parser?",
      "the name says which behaviour the test checks",
      "the name is a vague label that does not say which behaviour the test checks",
    ),
  },
  rubric: `Name: states the behaviour the test checks, not a vague label or only the unit name.`,
});
