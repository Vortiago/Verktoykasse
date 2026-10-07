// canonical source: test-audit/checks/asserts/check.mjs@0252a4d sha256:039210e699b234fb13ef4a9ef5ce6eb836eb9aa14a5beda4adc3c56d5974c1eb - vendored copy, do not edit here
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
  behaviour:
    "an output value or effect of the code under test, compared with an expected value the test fixes itself: a literal, a constant the test file declares, or a value the test computes without calling the code under test",
  "hardcoded-data":
    "an expected value taken from the code under test itself, such as a constant it exports or a second call to the same code, so both sides agree by construction",
  "input-only": "its own input or setup, not what the code under test produced",
  "shape-only": "only the type, length, keys, presence, or definedness of a result, not its content, even when compared with a literal such as a list of key names",
  "interaction-only": "only that a mock or spy was called, how often, or with what, not the result it stands in for",
  nothing: "no assertion, a tautology such as true === true, or only that the call did not throw",
};

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "asserts",
  role: "asserts",
  kinds: KINDS,
  questions: {
    // A test with several assertions is judged by its strongest one, so a
    // status check beside a body check does not split the twins.
    asserts_a: choice("Taken together, what do the assertions of this test check about the code under test? Pick the kind of the strongest assertion.", { ...KINDS }),
    // The same question with the answer order reversed: a position-swap control.
    asserts_b: choice("What does the strongest assertion in this test check?", Object.fromEntries(Object.entries(KINDS).reverse())),
  },
});
