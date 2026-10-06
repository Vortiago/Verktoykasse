// canonical source: test-audit/checks/fast/check.mjs@4ba9d42 sha256:43a887013bf7d5e8843891bb7f10976830ccb4b6a8b633e890a2716b1752a9a5 - vendored copy, do not edit here
// The fast check: does the test run in milliseconds, with no sleep, heavy I/O, or
// large computation? A "no" raises the `slow` flag.
//
// Sources:
// - Kent Beck, Test Desiderata (2019): Fast
//   https://kentbeck.github.io/TestDesiderata/
//   Tests run quickly.
// - Gerard Meszaros, xUnit Test Patterns (2007): Slow Tests
//   http://xunitpatterns.com/
//   Slow tests run less often, so they give feedback later.
// - testsmells.org, Open Catalog of Test Smells: Sleepy Test
//   https://testsmells.org/pages/testsmells.html
//   A test that waits with a sleep is slow, and it can give a different result
//   on a slow machine.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "fast",
  role: "descriptive",
  flag: "slow",
  questions: {
    fast: noul("Does the test run fast, with no sleep, no heavy I/O, and no large computation?", "it runs fast", "it sleeps, waits, or does heavy work"),
  },
  rubric: `Fast: the test runs in milliseconds, with no sleep, heavy I/O, or large computation.`,
});
