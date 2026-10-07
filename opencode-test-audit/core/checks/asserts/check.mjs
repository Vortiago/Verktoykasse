// canonical source: test-audit/checks/asserts/check.mjs@45c4fac sha256:f6975804d5230568ca478c8be7707222b26e9d176c5b79485315ffa2b817f39b - vendored copy, do not edit here
// The asserts check: what does the assertion closest to the behaviour check?
// Only `behaviour` is a real guard. An expected value from the code under test
// (or re-implemented in the test), input only, shape only, interaction only,
// nothing, and unclear escalate. The second phrasing lists the kinds in reverse
// order, as a position control, so the two answers must agree by key. That an
// interaction-only assertion escalates is a house choice.
//
// The position swap and its sources are in classifier/verdict.mjs.
//
// Sources:
// - testsmells.org, Open Catalog of Test Smells: Redundant Assertion, Unknown
//   Test
//   https://testsmells.org/pages/testsmells.html
//   An assertion that is always true, or no assertion, does not guard the
//   behaviour.
// - Gerard Meszaros, xUnit Test Patterns (2007): Production Logic in Test (in
//   Obscure Test)
//   http://xunitpatterns.com/Obscure%20Test.html
//   An expected value that the test computes the way the code does agrees with
//   the code by construction.
// - Gerard Meszaros, xUnit Test Patterns (2007): Overspecified Software (in
//   Fragile Test)
//   http://xunitpatterns.com/Fragile%20Test.html
//   A test that checks only the calls the code makes passes only for one
//   implementation.
// - Martin Fowler, Mocks Aren't Stubs (2007)
//   https://martinfowler.com/articles/mocksArentStubs.html
//   State verification checks the result; behaviour verification checks the
//   calls to a collaborator. Fowler names it a style with trade-offs.
// - the house catalogue, verify-prd-implemented/test-patterns.md:
//   Shape-not-value
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
//   A check of the type, the length, or the keys survives a result that is
//   wrong everywhere.

import { choice } from "../../classifier/systemone.mjs";

/** The kinds of assertion, best first: the first kind is the one real guard. */
const KINDS = {
  behaviour: "the output, against a value the test fixes or computes without the code",
  "from-code": "the output, against a value from the code under test or a re-implementation of it in the test",
  "input-only": "only the test's own input or setup, or an output field copied straight from the input",
  "shape-only": "only type, length, keys, presence, a bound, or that it is truthy or defined",
  "interaction-only": "only that a mock or spy was called, not with what",
  nothing: "nothing, a tautology, or only no throw",
  unclear: null,
};

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "asserts",
  role: "asserts",
  kinds: KINDS,
  questions: {
    asserts_a: choice("Of all assertions, what does the one closest to the behaviour check?", { ...KINDS }),
    asserts_b: choice("Of all assertions, what does the one closest to the behaviour check?", Object.fromEntries(Object.entries(KINDS).reverse())),
  },
});
