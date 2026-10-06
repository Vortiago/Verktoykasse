// The named check: does the test's name state the behaviour and the expected
// result, not a vague label? A "no" raises the `vague-name` flag.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
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
  sources: [
    { name: "Meszaros, xUnit Test Patterns: Obscure Test", url: "http://xunitpatterns.com/Obscure%20Test.html" },
    { name: "testsmells.org, Open Catalog of Test Smells: Unknown Test", url: "https://testsmells.org/pages/testsmells.html" },
  ],
};
