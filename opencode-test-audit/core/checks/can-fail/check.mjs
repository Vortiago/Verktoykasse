// canonical source: test-audit/checks/can-fail/check.mjs@c34fea8 sha256:92a3d691dc35d8ae427674506545a70378b9ba7ae21b5b400831199fbf26ef7a - vendored copy, do not edit here
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
      "Can a bug in the behaviour this test names make the test fail?",
      "yes: some bug in that behaviour fails it",
      "no: it passes whatever the code does, as with a tautology, both sides from the code, or an assertion that never runs",
    ),
    can_fail_c: noul(
      "If the named behaviour regresses, does this test turn red?",
      "yes: a regression fails it",
      "no: a regression leaves it passing",
    ),
  },
  negated: [],
});
