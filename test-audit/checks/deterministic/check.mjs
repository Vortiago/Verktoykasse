// The deterministic check: does the test give the same result on every run? A
// sleep, the real clock, the network, real randomness, or an unguaranteed order
// can make the same code give a different result. A faked or seeded source is
// fine. A "no" raises the
// `non-deterministic` flag. A flaky guard is still a guard, so it reports and
// does not escalate.
//
// Sources:
// - Kent Beck, Test Desiderata (2019): Deterministic, Isolated
//   https://kentbeck.github.io/TestDesiderata/
//   If nothing changes, the result does not change.
// - Gerard Meszaros, xUnit Test Patterns (2007): Erratic Test (Nondeterministic
//   Test, Resource Optimism, Interacting Tests, Test Run War)
//   http://xunitpatterns.com/Erratic%20Test.html
//   Nondeterminism, an assumed resource, or a shared resource makes the result
//   vary between runs.
// - testsmells.org, Open Catalog of Test Smells: Sleepy Test, Mystery Guest,
//   Resource Optimism
//   https://testsmells.org/pages/testsmells.html
//   A sleep or an external resource makes the result depend on the environment.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "deterministic",
  role: "descriptive",
  flag: "non-deterministic",
  questions: {
    deterministic: noul(
      "Does this test give the same result on every run? It does not when it reads the real clock or real randomness, calls the network, waits on a sleep, or relies on an order nothing guarantees. A clock, timer, or random source that the test fakes or seeds is under its control and is fine.",
      "the result is the same on every run of the same code",
      "the result can differ between runs of the same code",
    ),
  },
  rubric: `Deterministic: same result every run of the same code, with no sleep, real
  clock, network, real randomness, or unguaranteed order. A faked or seeded clock,
  timer, or random source is fine.`,
});
