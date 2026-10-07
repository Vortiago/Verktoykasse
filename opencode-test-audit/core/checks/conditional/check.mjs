// canonical source: test-audit/checks/conditional/check.mjs@c34fea8 sha256:4d34bd94b901080b0d2833273891bc713b61125f5567ac5af684f732a009de59 - vendored copy, do not edit here
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
      "Does every assertion always run?",
      "yes: no branch, loop, early return, or catch can skip or swallow one",
      "no: a branch, a loop over a value that may be empty, an early return, or a catch can skip or swallow one",
    ),
  },
});
