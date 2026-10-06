// canonical source: test-audit/checks/magic-number/check.mjs@9ae1caa sha256:473afdb2ff61f2186cd6c24b65276d515361cd3ab3c8bd427df64604bf9b027f - vendored copy, do not edit here
// The magic-number check: can the reader tell what each literal in the assertion
// means from the test itself? A code or total that must be looked up in the code
// under test is a magic number; a plain result of the input is not. A "no" raises
// the `magic-number` flag.
//
// Sources:
// - testsmells.org, Open Catalog of Test Smells: Magic Number Test
//   https://testsmells.org/pages/testsmells.html
//   An assertion with an unexplained number literal is hard to read.
// - Gerard Meszaros, xUnit Test Patterns (2007): Hard-Coded Test Data (in
//   Obscure Test)
//   http://xunitpatterns.com/Obscure%20Test.html
//   A literal value with no name hides the cause and effect of the test.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "magic_number",
  role: "descriptive",
  flag: "magic-number",
  questions: {
    magic_number: noul(
      "Can a reader tell what each literal in the assertion means from the test name, the input, or a name beside it? A plain result of the input, such as 180 seconds for 3 minutes, is fine. A code, a flag, or a total that the reader must look up in the code under test is a magic number.",
      "the meaning of each literal is clear from the test",
      "a literal must be looked up in the code under test",
    ),
  },
  rubric: `Magic number: a literal in the assertion whose meaning the reader must look up
  in the code under test. A plain result of the input is not one.`,
});
