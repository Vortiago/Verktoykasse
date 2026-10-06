// canonical source: test-audit/checks/resilient/check.mjs@9ae1caa sha256:c09997e64f38b393b286b6989444f3b1dd13d767ceca502e54318e0ce327ff81 - vendored copy, do not edit here
// The resilient check: does the test reach the code only through its public
// interface, so a refactor that keeps the behaviour keeps it green? An internal
// import, a spy on a helper, a private field, or a pinned call order says no. A
// "no" raises the `structure-dependent` flag.
//
// Sources:
// - Kent Beck, Test Desiderata (2019): Structure-insensitive
//   https://kentbeck.github.io/TestDesiderata/
//   A test does not change its result when the structure of the code changes.
// - Gerard Meszaros, xUnit Test Patterns (2007): Fragile Test, Sensitive
//   Equality
//   http://xunitpatterns.com/
//   A test that breaks on a change that keeps the behaviour costs work and
//   trust.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "resilient",
  role: "descriptive",
  flag: "structure-dependent",
  questions: {
    resilient: noul(
      "Would a refactor that keeps the public behaviour of the code under test keep this test green? Answer no when the test imports an internal module, spies on an internal helper, reads a private field, pins the order of internal calls, or pins an internal structure in a snapshot.",
      "the test reaches the code only through its public interface and asserts only results, so a refactor keeps it green",
      "the test pins an internal module, helper, field, call order, or structure, so a refactor breaks it",
    ),
  },
  rubric: `Structure-insensitive: the test reaches the code only through its public
  interface, so a refactor that keeps the behaviour does not break it.`,
});
