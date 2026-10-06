// canonical source: test-audit/checks/conditional/check.mjs@4ba9d42 sha256:25f1e55821a6559cda239bfd33a5e1201f1126784fd95961c13a6bfcf81879f9 - vendored copy, do not edit here
// The conditional check: does the assertion always run? A branch, loop, or catch
// that can leave it unrun lets the test assert nothing on some inputs. A "no"
// raises the `conditional` flag.
//
// Sources:
// - Gerard Meszaros, xUnit Test Patterns (2007): Conditional Test Logic
//   http://xunitpatterns.com/Conditional%20Test%20Logic.html
//   A branch or a loop in a test can leave the assertion unrun.
// - testsmells.org, Open Catalog of Test Smells: Conditional Test Logic
//   https://testsmells.org/pages/testsmells.html
//   Control flow in a test method is a smell that a tool can find.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "conditional",
  role: "descriptive",
  flag: "conditional",
  questions: {
    conditional: noul(
      "Does this test assert unconditionally, with no branch, loop, or catch that can leave the assertion unrun?",
      "the assertion always runs",
      "a branch, loop, or catch can leave the assertion unrun",
    ),
  },
  rubric: `Conditional test logic: a branch, loop, or catch that can leave the assertion
  unrun, so the test may assert nothing on some inputs.`,
});
