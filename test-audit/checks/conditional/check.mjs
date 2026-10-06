// The conditional check: does the assertion always run? A branch, loop, or catch
// that can leave it unrun lets the test assert nothing on some inputs. A "no"
// raises the `conditional` flag.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
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
  sources: [
    { name: "Meszaros, xUnit Test Patterns: Conditional Test Logic", url: "http://xunitpatterns.com/Conditional%20Test%20Logic.html" },
    { name: "testsmells.org, Open Catalog of Test Smells: Conditional Test Logic", url: "https://testsmells.org/pages/testsmells.html" },
  ],
};
