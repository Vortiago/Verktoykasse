// The asserts check: what does the assertion actually check? Only `behaviour`
// is a real guard. Hardcoded data, shape only, interaction only, and nothing
// escalate. The second phrasing lists the kinds in reverse order, as a position
// control, so the two answers must agree by key.

import { choice } from "../../classifier/systemone.mjs";

/** The kinds of assertion, best first: the first kind is the one real guard. */
const KINDS = {
  behaviour: "it checks the output value or observable behaviour the code produces, against a literal expected result",
  "hardcoded-data": "it repeats the same data the code under test is built from, so it agrees by construction",
  "shape-only": "it checks only the type, length, or keys of a result, not its content",
  "interaction-only": "it checks only that a mock or spy was called, not the behaviour it stands in for",
  nothing: "it asserts nothing, or only a tautology such as true === true",
};

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "asserts",
  role: "asserts",
  kinds: KINDS,
  questions: {
    asserts_a: choice("What does this test actually assert about the code under test?", { ...KINDS }),
    // The same question with the answer order reversed: a position-swap control.
    asserts_b: choice("What does the test's assertion actually check?", Object.fromEntries(Object.entries(KINDS).reverse())),
  },
  sources: [
    { name: "testsmells.org, Open Catalog of Test Smells: Redundant Assertion, Unknown Test, Magic Number Test, Sensitive Equality", url: "https://testsmells.org/pages/testsmells.html" },
    { name: "Meszaros, xUnit Test Patterns: Obscure Test (Hard-Coded Test Data, Indirect Testing)", url: "http://xunitpatterns.com/Obscure%20Test.html" },
    { name: "Martin Fowler, Mocks Aren't Stubs (2007)", url: "https://martinfowler.com/articles/mocksArentStubs.html" },
    { name: "the house catalogue: shape-not-value, nothing asserted, hardcoded data", url: "https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md" },
    { name: "Zheng et al., Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (2023), position bias, for the order swap", url: "https://arxiv.org/abs/2306.05685" },
    { name: "Wang et al., Large Language Models are not Fair Evaluators (2023), balanced position calibration, for the order swap", url: "https://arxiv.org/abs/2305.17926" },
  ],
};
