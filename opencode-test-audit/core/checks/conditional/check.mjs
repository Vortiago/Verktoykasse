// canonical source: test-audit/checks/conditional/check.mjs@9ae1caa sha256:b6638c6a76d01d0387af1769bd581cbda97446f77eb332359a1e6b853fe84cbc - vendored copy, do not edit here
// The conditional check: does every assertion always run? A branch, a loop over
// a value that may be empty, an early return, or a catch that can leave one unrun
// lets the test assert nothing on some inputs. A "no"
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
      "Does every assertion in this test always run? Answer no when a branch, a loop over a value that may be empty, an early return, or a try/catch can leave an assertion unrun or swallow its failure.",
      "every assertion always runs",
      "a branch, loop, early return, or catch can leave an assertion unrun or swallow its failure",
    ),
  },
  rubric: `Conditional test logic: a branch, a loop over a value that may be empty, an
  early return, or a catch that can leave an assertion unrun or swallow its
  failure, so the test may assert nothing on some inputs.`,
});
