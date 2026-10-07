// canonical source: test-audit/checks/can-fail/check.mjs@0252a4d sha256:504330dc8a26031285d1cb8d995714962f6c828791d0390508d6f9dfbd9d23b6 - vendored copy, do not edit here
// The can-fail check: does the test fail when the behaviour it names breaks in
// the code under test? A tautology, a self-reference, a shape or definedness
// check, and a test that passes with zero results all say no. The tool asks three equivalent phrasings, one of them
// negated, and trusts the mean only when they agree (ADR 0007).
//
// The twin rule and its sources are in classifier/verdict.mjs.
//
// Sources:
// - Kent Beck, Test Desiderata (2019): Behavioral
//   https://kentbeck.github.io/TestDesiderata/
//   A test must be sensitive to a change in the behaviour of the code under
//   test.
// - Web Platform Tests, Review Checklist: "The test fails when it's supposed to
//   fail"
//   https://web-platform-tests.org/reviewing-tests/checklist.html
//   A reviewer checks that the test goes red when the code is wrong.
// - Gerard Meszaros, xUnit Test Patterns (2007): Erratic Test
//   http://xunitpatterns.com/Erratic%20Test.html
//   A test whose result does not follow the code under test gives no signal
//   that a reader can trust.
// - Goran Petrović and Marko Ivanković, State of Mutation Testing at Google
//   (ICSE-SEIP 2018)
//   https://research.google/pubs/state-of-mutation-testing-at-google/
//   Mutation testing measures, at industrial scale, whether the tests fail when
//   the code changes.
// - René Just et al., Are Mutants a Valid Substitute for Real Faults in
//   Software Testing? (FSE 2014)
//   https://doi.org/10.1145/2635868.2635929
//   A test that fails on a mutant tends to find real faults, so "can a change
//   make it fail" is a useful proxy.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "can_fail",
  role: "can-fail",
  questions: {
    // All three ask one judgement: does the test fail when the behaviour it
    // names breaks? An "any change can fail it" reading splits from it on every
    // shape or interaction test, so no phrasing asks about any change.
    can_fail_a: noul(
      "Break the behaviour this test names, in the code under test only. Does the test then fail? Any break counts, including one that changes only the shape of the result or makes the call throw.",
      "the test fails when the named behaviour is broken",
      "the test still passes when the named behaviour is broken",
    ),
    // The negated twin. After polarity normalisation it must agree with `a`.
    can_fail_b: noul(
      "Does this test keep passing however the code under test breaks the behaviour this test names?",
      "no break of the named behaviour makes the test fail",
      "some break of the named behaviour makes the test fail",
    ),
    can_fail_c: noul(
      "If the behaviour this test names regresses, does the test fail?",
      "a regression in that behaviour makes the test fail",
      "a regression in that behaviour leaves the test passing",
    ),
  },
  negated: ["can_fail_b"],
  rubric: `Falsifiable: some break of the named behaviour in the code under test makes
  the test fail. Not falsifiable: no break can, as in a tautology (true === true, or
  both sides call the same code), an assertion on data the code copies straight
  from its input, or one that runs zero times. A shape, truthy, or no-throw check
  can still fail.`,
});
