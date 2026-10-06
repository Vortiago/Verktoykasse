// The asserts check: what does the assertion actually check? Only `behaviour`
// is a real guard. Hardcoded data, shape only, interaction only, and nothing
// escalate. The second phrasing lists the kinds in reverse order, as a position
// control, so the two answers must agree by key.
//
// The position swap and its sources are in classifier/verdict.mjs.
//
// Sources:
// - testsmells.org, Open Catalog of Test Smells: Redundant Assertion, Unknown
//   Test, Magic Number Test, Sensitive Equality
//   https://testsmells.org/pages/testsmells.html
//   An assertion that is always true, that is missing, or that compares a
//   string form does not guard the behaviour.
// - Gerard Meszaros, xUnit Test Patterns (2007): Obscure Test (Hard-Coded Test
//   Data, Indirect Testing)
//   http://xunitpatterns.com/Obscure%20Test.html
//   Expected data from the code itself, or a check through another object,
//   hides what the test verifies.
// - Martin Fowler, Mocks Aren't Stubs (2007)
//   https://martinfowler.com/articles/mocksArentStubs.html
//   State verification checks the result. Behaviour verification checks only
//   the calls to a collaborator.
// - the house catalogue, verify-prd-implemented/test-patterns.md:
//   Shape-not-value
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
//   A check of the type, the length, or the keys survives a result that is
//   wrong everywhere.

import { choice } from "../../classifier/systemone.mjs";

/** The kinds of assertion, best first: the first kind is the one real guard. */
const KINDS = {
  behaviour: "it checks the output value or observable behaviour the code produces, against a literal expected result",
  "hardcoded-data": "it repeats the same data the code under test is built from, so it agrees by construction",
  "shape-only": "it checks only the type, length, or keys of a result, not its content",
  "interaction-only": "it checks only that a mock or spy was called, not the behaviour it stands in for",
  nothing: "it asserts nothing, or only a tautology such as true === true",
};

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "asserts",
  role: "asserts",
  kinds: KINDS,
  questions: {
    asserts_a: choice("What does this test actually assert about the code under test?", { ...KINDS }),
    // The same question with the answer order reversed: a position-swap control.
    asserts_b: choice("What does the test's assertion actually check?", Object.fromEntries(Object.entries(KINDS).reverse())),
  },
});
