// canonical source: test-audit/checks/resilient/check.mjs@4ba9d42 sha256:a08ae84175e2dc3c4e859065f7ad0ad92df41b126131d183c12d73a9a063c860 - vendored copy, do not edit here
// The resilient check: does the test stay green through a refactor of the code
// under test that keeps the behaviour? A "no" raises the `structure-dependent`
// flag.
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
      "Would this test stay green through a refactor of the code under test that keeps the same behaviour?",
      "the test checks behaviour, so a behaviour-preserving refactor keeps it green",
      "the test depends on the current structure, so a refactor breaks it",
    ),
  },
  rubric: `Structure-insensitive: a refactor of the code under test that keeps the behaviour
  does not break the test.`,
});
