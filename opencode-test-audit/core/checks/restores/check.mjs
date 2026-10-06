// canonical source: test-audit/checks/restores/check.mjs@9ae1caa sha256:98208f0c142a86c5fd6e1b30a746277afed36b8ca03dcd2888a362763b1bd833 - vendored copy, do not edit here
// The restores check: does the test, or an after hook, restore every global,
// environment variable, timer, module mock, and spy that it changes? A test that
// changes none restores state. A "no" raises the `state-leak` flag.
//
// Sources:
// - Kent Beck, Test Desiderata (2019): Isolated
//   https://kentbeck.github.io/TestDesiderata/
//   A test gives the same result in any order of the run.
// - Gerard Meszaros, xUnit Test Patterns (2007): Interacting Tests, Test Run
//   War (in Erratic Test)
//   http://xunitpatterns.com/Erratic%20Test.html
//   A test that leaves shared state changed makes another test pass or fail.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "restores",
  role: "descriptive",
  flag: "state-leak",
  questions: {
    restores: noul(
      "Does the test leave every global, environment variable, timer, module mock, and spy as it found them? A restore in an after hook in fixtures counts. A test that changes none of these counts as yes.",
      "it changes none of these, or it restores what it changes",
      "it leaves a global, environment variable, timer, mock, or spy changed",
    ),
  },
  rubric: `Restores state: the test, or an after hook, restores every global, environment
  variable, timer, module mock, and spy it changes. A test that changes none
  restores state.`,
});
