// canonical source: test-audit/checks/fast/check.mjs@9ae1caa sha256:4866ed13cb9c738ae33128ce378a76eff4d7f997d4917e56215eabfbe7a3f404 - vendored copy, do not edit here
// The fast check: does the test finish with no sleep, poll, network or disk call,
// or large computation? A "no" raises the `slow` flag.
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
    fast: noul(
      "Does the test finish without a sleep, a poll, a network or disk call, or a loop over a large input? An await on an in-memory promise is fine.",
      "it does none of these",
      "it sleeps, polls, calls the network or disk, or computes over a large input",
    ),
  },
  rubric: `Fast: no sleep, poll, network or disk call, or large computation.`,
});
