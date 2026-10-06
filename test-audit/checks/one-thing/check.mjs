// The one-thing check: does the test check one behaviour, not several unrelated
// behaviours at once? A "no" raises the `eager` flag.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "one_thing",
  role: "descriptive",
  flag: "eager",
  questions: {
    one_thing: noul(
      "Does this test check one behaviour, rather than several unrelated behaviours at once?",
      "it checks one behaviour",
      "it is an eager test that checks several unrelated things",
    ),
  },
  rubric: `One behaviour: the body checks one thing, not several unrelated behaviours.`,
  sources: [
    { name: "Meszaros, xUnit Test Patterns: Eager Test (in Obscure Test and Assertion Roulette)", url: "http://xunitpatterns.com/Obscure%20Test.html" },
    { name: "testsmells.org, Open Catalog of Test Smells: Eager Test", url: "https://testsmells.org/pages/testsmells.html" },
  ],
};
