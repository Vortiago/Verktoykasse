// The can-fail check: can a change to the code under test make this test fail?
// A tautology, a self-reference, a vacuous check, and a test that passes with
// zero results all say no. The tool asks three equivalent phrasings, one of them
// negated, and trusts the mean only when they agree (ADR 0007).

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
    { name: "Kent Beck, Test Desiderata (Behavioral)", url: "https://kentbeck.github.io/TestDesiderata/" },
    { name: "Web Platform Tests, Review Checklist: \"The test fails when it's supposed to fail\"", url: "https://web-platform-tests.org/reviewing-tests/checklist.html" },
    { name: "Meszaros, xUnit Test Patterns: Erratic Test", url: "http://xunitpatterns.com/Erratic%20Test.html" },
    { name: "Petrovic and Ivankovic, State of Mutation Testing at Google (2018)", url: "https://research.google/pubs/state-of-mutation-testing-at-google/" },
    { name: "Just et al., Are Mutants a Valid Substitute for Real Faults in Software Testing? (2014)", url: "https://doi.org/10.1145/2635868.2635929" },
    { name: "Wang et al., Self-Consistency Improves Chain of Thought Reasoning (2023), for the phrasings", url: "https://arxiv.org/abs/2203.11171" },
    { name: "Sclar et al., Quantifying Language Models' Sensitivity to Spurious Features in Prompt Design (2024), for the phrasings", url: "https://arxiv.org/abs/2310.11324" },
  ],
};
