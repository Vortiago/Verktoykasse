// The asserts check: what does the strongest assertion check? Only `behaviour`
// is a real guard. Hardcoded data, input only, shape only, interaction only, and
// nothing escalate. The second phrasing lists the kinds in reverse order, as a position
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
  behaviour: "the output, against a value the test fixes or computes without the code",
  "hardcoded-data": "the output, against a value from the code under test itself",
  "input-only": "only the test's own input or setup",
  "shape-only": "only type, length, keys, presence, or that it is truthy or defined",
  "interaction-only": "only that a mock or spy was called",
  nothing: "nothing, a tautology, or only no throw",
  unclear: null,
};

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "asserts",
  role: "asserts",
  kinds: KINDS,
  questions: {
    asserts_a: choice("What does the strongest assertion check?", { ...KINDS }),
    asserts_b: choice("What does the strongest assertion check?", Object.fromEntries(Object.entries(KINDS).reverse())),
  },
});
