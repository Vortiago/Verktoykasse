// The can-fail check: can a change to the code under test make this test fail?
// A tautology, a self-reference, a vacuous check, and a test that passes with
// zero results all say no. The tool asks three equivalent phrasings, one of them
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

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "can_fail",
  role: "can-fail",
  questions: {
    // The best single phrasing is the concrete, operational one, so it leads.
    can_fail_a: noul(
      "Could you make this test fail by changing only the code under test?",
      "a change to the code under test can make it fail",
      "no change to the code under test can make it fail",
    ),
    // The negated twin. After polarity normalisation it must agree with `a`.
    can_fail_b: noul(
      "Does this test pass regardless of whether the code under test is correct?",
      "it passes even when the behaviour is broken",
      "broken behaviour makes it fail",
    ),
    can_fail_c: noul(
      "If the behaviour this test exercises regresses, will the test fail?",
      "the assertion can catch a regression in the behaviour",
      "the assertion misses the regression and still passes",
    ),
  },
  negated: ["can_fail_b"],
  rubric: `Falsifiable: a change to the code under test makes the test fail.
  Not falsifiable: a tautology (true === true, or both sides call the same code);
  a check that the result is merely defined, non-null, or the right shape;
  an assertion on data the code copies straight from its input.`,
  sources: [
    { name: "Kent Beck, Test Desiderata (2019): Behavioral", url: "https://kentbeck.github.io/TestDesiderata/" },
    { name: "Web Platform Tests, Review Checklist: \"The test fails when it's supposed to fail\"", url: "https://web-platform-tests.org/reviewing-tests/checklist.html" },
    { name: "Gerard Meszaros, xUnit Test Patterns (2007): Erratic Test", url: "http://xunitpatterns.com/Erratic%20Test.html" },
    { name: "Goran Petrović and Marko Ivanković, State of Mutation Testing at Google (ICSE-SEIP 2018)", url: "https://research.google/pubs/state-of-mutation-testing-at-google/" },
    { name: "René Just et al., Are Mutants a Valid Substitute for Real Faults in Software Testing? (FSE 2014)", url: "https://doi.org/10.1145/2635868.2635929" },
  ],
};
