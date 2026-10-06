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
  sources: [
    { name: "Kent Beck, Test Desiderata (2019): Fast", url: "https://kentbeck.github.io/TestDesiderata/" },
    { name: "Gerard Meszaros, xUnit Test Patterns (2007): Slow Tests", url: "http://xunitpatterns.com/" },
    { name: "testsmells.org, Open Catalog of Test Smells: Sleepy Test", url: "https://testsmells.org/pages/testsmells.html" },
  ],
});
