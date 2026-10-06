// The restores check: does the test restore every global, environment variable,
// timer, and spy that it changes? A "no" raises the `state-leak` flag.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "restores",
  role: "descriptive",
  flag: "state-leak",
  questions: {
    restores: noul(
      "Does the test restore every global, environment variable, timer, and spy that it changes, so it leaves nothing for the next test?",
      "it clears or restores what it changes",
      "it leaves process or module state changed for the next test",
    ),
  },
  rubric: `Restores state: the test clears or restores every global, environment variable,
  timer, and spy it changes, so it leaves nothing for the next test.`,
  sources: [
    { name: "Kent Beck, Test Desiderata (Isolated)", url: "https://kentbeck.github.io/TestDesiderata/" },
    { name: "Meszaros, xUnit Test Patterns: Interacting Tests, Test Run War (in Erratic Test)", url: "http://xunitpatterns.com/Erratic%20Test.html" },
    { name: "testsmells.org, Open Catalog of Test Smells: Test Pollution", url: "https://testsmells.org/pages/testsmells.html" },
  ],
};
