// canonical source: test-audit/checks/readable/check.mjs@4ba9d42 sha256:b2245e190b1c88afb70d62b2f40534a71d379c8e7e3b2fa4098babdc564db9a5 - vendored copy, do not edit here
// The readable check: can a reader tell what the test does and why, without
// opening the code under test? A "no" raises the `obscure` flag.
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
      "Can a reader tell what this test does and why, without opening the code under test?",
      "the test reads clearly on its own",
      "the reader must open the code under test to understand it",
    ),
  },
  rubric: `Readable: a reader can tell what the test does and why without opening the code
  under test.`,
});
