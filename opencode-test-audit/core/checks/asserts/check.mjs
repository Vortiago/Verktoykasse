// canonical source: test-audit/checks/asserts/check.mjs@c2891f2 sha256:d0a3056a17acc1b6bbd2f08c8f8758dd742228601a8231e661899f200b0687f6 - vendored copy, do not edit here
// The asserts check: what does the strongest assertion check? Only `behaviour`
// is a real guard. Five yes/no questions each judge one property: does an
// assertion compare content, does the test write its own expected value, and is
// every assertion only about the shape, a mock call, or its own input. Code picks
// the kind from the answers. An expected value from the code under test, input
// only, shape only, interaction only, and nothing escalate. Answers that
// contradict each other, such as "compares content" beside "only the shape",
// escalate as unstable. A choice question lost to position bias on two decision
// models (the last option won in either order), and yes/no questions have no
// order. That an interaction-only assertion escalates is a house choice.
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

import { noul } from "../../classifier/systemone.mjs";

/** The kinds of assertion, best first: the first kind is the one real guard. The model never sees these; code picks one from the answers. */
const KINDS = {
  behaviour: "the output, against a value the test fixes or computes without the code",
  "from-code": "the output, against a value from the code under test itself",
  "input-only": "only the test's own input or setup",
  "shape-only": "only type, length, keys, presence, a bound, or truthy",
  "interaction-only": "only that a mock was called",
  nothing: "no assertion, a tautology, or only no throw",
};

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "asserts",
  role: "asserts",
  kinds: KINDS,
  questions: {
    asserts_content: noul(
      "Does an assertion compare the content of the output with an expected value?",
      "yes: it checks what the output holds",
      "no: only its type, length, keys, or truthiness, or nothing at all",
    ),
    asserts_own_value: noul(
      "Does the test write its expected value itself, as a literal or its own computation?",
      "yes: the test fixes it",
      "no: it comes from the code under test",
    ),
    asserts_shape_only: noul(
      "Do all assertions check only type, length, its list of keys, a bound, or truthiness?",
      "yes: only the shape",
      "no: an assertion checks a value",
    ),
    asserts_mock_only: noul(
      "Are all assertions about whether a mock or spy was called?",
      "yes: only mock calls",
      "no: an assertion checks a result",
    ),
    asserts_input_only: noul(
      "Do the assertions only read the test's own variables, never a value the code under test returned?",
      "yes: only its own input or setup",
      "no: they read a value the code returned",
    ),
  },
  // A yes to these is the finding, so the good answer is no.
  negated: ["asserts_shape_only", "asserts_mock_only", "asserts_input_only"],
});
