// The resilient check: does the test stay green through a refactor of the code
// under test that keeps the behaviour? A "no" raises the `structure-dependent`
// flag.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "resilient",
  role: "descriptive",
  flag: "structure-dependent",
  questions: {
    resilient: noul(
      "Would this test stay green through a refactor of the code under test that keeps the same behaviour?",
      "the test checks behaviour, so a behaviour-preserving refactor keeps it green",
      "the test depends on the current structure, so a refactor breaks it",
    ),
  },
  rubric: `Structure-insensitive: a refactor of the code under test that keeps the behaviour
  does not break the test.`,
  sources: [
    { name: "Kent Beck, Test Desiderata (Structure-insensitive)", url: "https://kentbeck.github.io/TestDesiderata/" },
    { name: "Meszaros, xUnit Test Patterns: Fragile Test, Sensitive Equality", url: "http://xunitpatterns.com/" },
  ],
};
