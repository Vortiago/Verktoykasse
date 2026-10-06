// The readable check: can a reader tell what the test does and why, without
// opening the code under test? A "no" raises the `obscure` flag.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "readable",
  role: "descriptive",
  flag: "obscure",
  questions: {
    readable: noul(
      "Can a reader tell what this test does and why, without opening the code under test?",
      "the test reads clearly on its own",
      "the reader must open the code under test to understand it",
    ),
  },
  rubric: `Readable: a reader can tell what the test does and why without opening the code
  under test.`,
  sources: [
    { name: "Kent Beck, Test Desiderata (Readable)", url: "https://kentbeck.github.io/TestDesiderata/" },
    { name: "Meszaros, xUnit Test Patterns: Obscure Test", url: "http://xunitpatterns.com/Obscure%20Test.html" },
    { name: "testsmells.org, Open Catalog of Test Smells: Unknown Test", url: "https://testsmells.org/pages/testsmells.html" },
  ],
};
