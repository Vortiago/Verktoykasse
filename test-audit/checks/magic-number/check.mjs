// The magic-number check: does the assertion name its values, rather than use a
// bare number or string the reader must decode? A "no" raises the `magic-number`
// flag.
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
      "Does the assertion name its values, rather than use a bare number or string the reader must decode?",
      "the values are named or self-explanatory",
      "a bare number or string must be decoded from the code under test",
    ),
  },
  rubric: `Magic number: the assertion names its values, rather than a bare number or string
  the reader must decode.`,
  sources: [
    { name: "testsmells.org, Open Catalog of Test Smells: Magic Number Test", url: "https://testsmells.org/pages/testsmells.html" },
    { name: "Gerard Meszaros, xUnit Test Patterns (2007): Hard-Coded Test Data (in Obscure Test)", url: "http://xunitpatterns.com/Obscure%20Test.html" },
  ],
});
