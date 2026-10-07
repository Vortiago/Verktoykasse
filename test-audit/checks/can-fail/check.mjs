// The can-fail check: can some bug in the behaviour the test names make it fail?
// A tautology, a self-reference, and a test that passes with zero results say
// no. A shape or definedness check can still fail; the asserts check says how
// weak it is. The tool asks two plain phrasings of "some wrong output fails it",
// and trusts the mean only when they agree (ADR 0007).
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
      "Would some wrong output of the behaviour this test names fail it?",
      "yes: a wrong output fails it",
      "no: every output passes it",
    ),
  },
  negated: [],
});
