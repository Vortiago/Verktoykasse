// canonical source: test-audit/checks/resilient/check.mjs@ee14484 sha256:632c42dea3f9fb8cb8849661fec5d066d59223f962290685d281623a6bac3ee5 - vendored copy, do not edit here
// The resilient check: does the test reach and read the code only through its
// public interface, so a refactor that keeps the behaviour keeps it green? An
// internal import, a spy on a helper, a private or `_` member, or a pinned
// internal call order says no. A "no" raises the `structure-dependent` flag,
// and the finding asks for a fix: the test can pass while the behaviour breaks,
// or fail while it holds.
//
// Sources:
// - Kent Beck, Test Desiderata (2019): Structure-insensitive
//   https://testdesiderata.com/
//   A test does not change its result when the structure of the code changes.
// - Gerard Meszaros, xUnit Test Patterns (2007): Fragile Test (Overspecified
//   Software)
//   http://xunitpatterns.com/Fragile%20Test.html
//   A test that pins how the code works, not what it does, passes only for one
//   implementation.
// - Gerard Meszaros, xUnit Test Patterns (2007): Indirect Testing (in Obscure
//   Test)
//   http://xunitpatterns.com/Obscure%20Test.html
//   A test that checks the code through another object hides what it verifies.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "resilient",
  role: "descriptive",
  flag: "structure-dependent",
  questions: {
    resilient: noul(
      "Does this test use only the public interface of the code?",
      "yes: a public import, and it asserts a return, a throw, or an effect a caller sees",
      "no: an internal import, a spy on a helper, a private or _ member, or a pinned internal call order",
    ),
  },
});
