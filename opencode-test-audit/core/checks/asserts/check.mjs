// canonical source: test-audit/checks/asserts/check.mjs@ccdc586 sha256:8ccd17fa0fb33c04ee61a05aa3058cdb99f7301f3f793bfb3b0f756d2ba4c576 - vendored copy, do not edit here
// The asserts check: does an assertion compare a result of the code with one
// exact value that the test writes? Only that, `behaviour`, is a real guard.
// Four short yes/no questions each judge one fact: an exact comparison of a
// result, an expected value the test writes, an expected value from the same
// code as the result (so the two agree by construction; two codebases checked
// against each other do not), and
// assertions that check only the
// shape or only a mock call. An assertion that reads only the test's own input
// checks no result of the code, so `asserts_exact` says no. Code picks the kind
// from the answers. An answer near 0.5 escalates only when it decides the kind:
// the rules try it both ways. Every
// other kind escalates. Answers that contradict each other, such as "an exact
// comparison" beside "only the shape", escalate as unstable. A check with no
// exact value (a limit, that a result exists) is weak, not empty, so it asks
// for a fix; only can_fail drops a test. A choice question lost to position bias on two decision
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
  behaviour: "a result of the code, against one exact value the test writes",
  "from-code": "a result of the code, against a value from the same code, so both always agree",
  inexact: "no exact value: only a limit, that a result exists, a constant, or nothing",
  "shape-only": "only the type, the size, or the keys of a result",
  "interaction-only": "only a call to a mock",
};

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "asserts",
  role: "asserts",
  kinds: KINDS,
  questions: {
    asserts_exact: noul(
      "Does an assertion compare a result of the code with one exact value?",
      "yes: it compares a result with one value, or with true or false",
      "no: it checks only a type, a size, keys, a limit, or no result",
    ),
    asserts_written: noul(
      "Does the test write the expected value as a literal or a calculation?",
      "yes: the test writes the expected value",
      "no: the test reads the expected value from code",
    ),
    asserts_same: noul(
      "Do the expected value and the checked result come from the same code?",
      "yes: they come from the same code, so they always agree",
      "no: they come from different sources",
    ),
    asserts_shape: noul(
      "Does each assertion check only the type, the size, or the keys of a result?",
      "yes: only the type, the size, or the keys",
      "no: an assertion checks a value",
    ),
    asserts_mock: noul(
      "Does each assertion check only a call to a mock?",
      "yes: only calls to a mock",
      "no: an assertion checks a result",
    ),
  },
  // A yes to these is the finding, so the good answer is no.
  negated: ["asserts_same", "asserts_shape", "asserts_mock"],
});
