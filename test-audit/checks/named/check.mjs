// The named check: does the test's name state the behaviour and the expected
// result, not a vague label? A "no" raises the `vague-name` flag.
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
      "Does the test's name state the behaviour and its expected result, rather than a vague label such as works, test1, or should be fine?",
      "the name states the behaviour and the expected result",
      "the name is vague",
    ),
  },
  rubric: `Name: states the behaviour and the expected result, not a vague label.`,
});
