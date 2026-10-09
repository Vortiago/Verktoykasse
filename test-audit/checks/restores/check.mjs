// The restores check: does the test, or an after hook, put back every global,
// environment variable, timer, mock, file, and shared object that it changes? A
// test that changes none restores state. A "no" raises the `state-leak` flag.
//
// Sources:
// - Kent Beck, Test Desiderata (2019): Isolated
//   https://kentbeck.github.io/TestDesiderata/
//   A test gives the same result in any order of the run.
// - Gerard Meszaros, xUnit Test Patterns (2007): Interacting Tests,
//   Unrepeatable Test (in Erratic Test)
//   http://xunitpatterns.com/Erratic%20Test.html
//   A test that leaves shared state changed makes another test pass or fail.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "restores",
  role: "descriptive",
  flag: "state-leak",
  questions: {
    restores: noul(
      "Does this test leave all shared state as it found it?",
      "yes: it changes none, or an after hook puts it back",
      "no: it leaves a global, env variable, timer, mock, or shared object changed",
    ),
  },
});
