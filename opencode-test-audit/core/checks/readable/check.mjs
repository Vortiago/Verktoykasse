// canonical source: test-audit/checks/readable/check.mjs@9ae1caa sha256:6fa0e4f9bd10d4c9200f77105c59ce4c20e2c7aad999ef05b86fdf7a6f8da18c - vendored copy, do not edit here
// The readable check: does the test show the input, the action, and the expected
// result, rather than hide them in a helper, an import, or an undefined name? A
// "no" raises the `obscure` flag.
//
// Sources:
// - Kent Beck, Test Desiderata (2019): Readable
//   https://kentbeck.github.io/TestDesiderata/
//   A test is comprehensible to its reader, and it shows why it was written.
// - Gerard Meszaros, xUnit Test Patterns (2007): Obscure Test
//   http://xunitpatterns.com/Obscure%20Test.html
//   A reader cannot tell what the test verifies.
// - testsmells.org, Open Catalog of Test Smells: Unknown Test
//   https://testsmells.org/pages/testsmells.html
//   A test that does not show what it verifies hides its purpose.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "readable",
  role: "descriptive",
  flag: "obscure",
  questions: {
    readable: noul(
      "Does the test show the input, the action, and the expected result? Answer no when the input or the expected value comes from a helper, an import, or a name that nothing shown defines, or when the comparison hides in a boolean.",
      "the input, the action, and the expected result are visible in the test",
      "the input or the expected value is hidden, or the comparison hides in a boolean",
    ),
  },
  rubric: `Readable: the input, the action, and the expected result are visible in the test,
  its hooks, or its setup.`,
});
