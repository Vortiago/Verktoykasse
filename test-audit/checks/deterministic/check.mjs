// The deterministic check: does the test give the same result on every run and
// machine? A sleep, the real clock, real randomness, an unguaranteed order, or a
// service, file, database, or environment variable the test does not start or
// fake can change the result. A faked or seeded source is fine, and so is a
// server the test starts itself. In 2026-10 two criteria failed on real e2e
// suites: "the network" flagged 17 tests that start their own server, and "a
// remote service" flagged 34. The yes criteria now name what the test starts,
// and the `local-server` case pins it.
// A "no" raises the `non-deterministic` flag: it does not escalate, and the
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
      "yes: the test fakes or seeds time and randomness, or starts the services it uses",
      "no: a sleep, the real clock, real randomness, or a service or file it does not start",
    ),
  },
});
