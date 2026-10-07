// canonical source: test-audit/checks/deterministic/check.mjs@45c4fac sha256:7b9898da27b087be64ec3e9c3eddc00356efd95f7051880936b3793efe46faab - vendored copy, do not edit here
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
      "Does this test give the same result on every run and machine?",
      "yes: no real clock, randomness, sleep, network, file, database, or env it does not create or fake",
      "no: it reads one as it finds it",
    ),
  },
});
