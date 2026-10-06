// canonical source: test-audit/checks/restores/check.mjs@4ba9d42 sha256:e3cbffb2237aff4de58f350a6a20a84d8cee33be87b5cd9d28512f7e512a1bdd - vendored copy, do not edit here
// The restores check: does the test restore every global, environment variable,
// timer, and spy that it changes? A "no" raises the `state-leak` flag.
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
      "Does the test restore every global, environment variable, timer, and spy that it changes, so it leaves nothing for the next test?",
      "it clears or restores what it changes",
      "it leaves process or module state changed for the next test",
    ),
  },
  rubric: `Restores state: the test clears or restores every global, environment variable,
  timer, and spy it changes, so it leaves nothing for the next test.`,
});
