// canonical source: test-audit/checks/can-fail/check.mjs@aa397d5 sha256:60c0030c33c1c1360b83dddd2b2fa32d8b89ea14b7eae9df40c112f2cfd8cfbf - vendored copy, do not edit here
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
    can_fail_a: noul(
      "Can breaking the named behaviour in the code under test make this test fail?",
      "some break makes it fail",
      "no break makes it fail",
    ),
    can_fail_b: noul(
      "Does this test pass however the code under test breaks the named behaviour?",
      "it always passes",
      "some break makes it fail",
    ),
    can_fail_c: noul(
      "If the named behaviour regresses, can this test turn red?",
      "a regression can fail it",
      "a regression leaves it passing",
    ),
  },
  negated: ["can_fail_b"],
  rubric: `Falsifiable: some break of the named behaviour in the code under test makes
  the test fail. Not falsifiable: no break can, as in a tautology (true === true, or
  both sides call the same code), an assertion on data the code copies straight
  from its input, or one that runs zero times. A shape, truthy, or no-throw check
  can still fail.`,
});
