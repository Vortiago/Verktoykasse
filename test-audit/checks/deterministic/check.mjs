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
      "Does this test give the same result on every run?",
      "yes: no real clock, randomness, network, sleep, or unguaranteed order, or it is faked or seeded",
      "no: it uses the real clock, randomness, the network, a sleep, or an unguaranteed order",
    ),
  },
});
