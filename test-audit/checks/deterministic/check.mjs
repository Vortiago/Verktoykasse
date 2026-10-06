// The deterministic check: does the test give the same result on every run? A
// sleep, the clock, the network, randomness, or order dependence can make it pass
// or fail for reasons outside the code under test. A "no" raises the
// `non-deterministic` flag. A flaky guard is still a guard, so it reports and
// does not escalate.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "deterministic",
  role: "descriptive",
  flag: "non-deterministic",
  questions: {
    deterministic: noul(
      "Does this test give the same result on every run, with no reliance on time, order, the network, or a sleep?",
      "it gives the same result every run",
      "it can pass or fail for reasons outside the code under test",
    ),
  },
  rubric: `Deterministic: same result every run, with no sleep, clock, network, randomness, or
  order dependence.`,
  sources: [
    { name: "Kent Beck, Test Desiderata (Deterministic, Isolated)", url: "https://kentbeck.github.io/TestDesiderata/" },
    { name: "Meszaros, xUnit Test Patterns: Erratic Test (Nondeterministic Test, Resource Optimism, Interacting Tests, Test Run War)", url: "http://xunitpatterns.com/Erratic%20Test.html" },
    { name: "testsmells.org, Open Catalog of Test Smells: Sleepy Test, Mystery Guest, Resource Optimism, Conditional Test Logic", url: "https://testsmells.org/pages/testsmells.html" },
  ],
};
