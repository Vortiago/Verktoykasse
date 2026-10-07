// The deterministic check: does the test give the same result on every run and
// machine? A sleep, the real clock, the network, real randomness, an
// unguaranteed order, or a file, database, or environment variable the test does
// not create or fake can change the result. A faked or seeded source is fine. A
// "no" raises the `non-deterministic` flag: it does not escalate, and the
// finding asks for a fix.
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
      "yes: nothing real-time, random, networked, or external, or it is faked",
      "no: it uses the real clock, randomness, a sleep, the network, or an external file or env",
    ),
  },
});
