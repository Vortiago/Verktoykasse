// The isolated check: does the test pass on its own and in any order, with no
// shared mutable state? A "no" raises the `order-dependent` flag.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "isolated",
  role: "descriptive",
  flag: "order-dependent",
  questions: {
    isolated: noul(
      "Does this test pass on its own and in any order, with no reliance on shared mutable state or another test?",
      "it is independent of other tests and of run order",
      "it shares state with, or depends on the order of, other tests",
    ),
  },
  rubric: `Isolated: passes on its own and in any order, with no shared mutable state and no
  dependence on another test.`,
  sources: [
    { name: "Kent Beck, Test Desiderata (Isolated)", url: "https://kentbeck.github.io/TestDesiderata/" },
    { name: "Meszaros, xUnit Test Patterns: Interacting Tests, Test Run War, Unrepeatable Test (in Erratic Test)", url: "http://xunitpatterns.com/Erratic%20Test.html" },
  ],
};
