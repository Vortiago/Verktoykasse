// The fixture check: does the test build only the data it needs, not a large
// shared fixture or values unrelated to the behaviour? A "no" raises the
// `general-fixture` flag.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "fixture",
  role: "descriptive",
  flag: "general-fixture",
  questions: {
    fixture: noul(
      "Does the test build only the data it needs, rather than a large shared fixture or values unrelated to the behaviour?",
      "it builds only the data it needs",
      "it leans on a large or unrelated fixture",
    ),
  },
  rubric: `Local fixture: the test builds only the data it needs, not a large shared fixture
  or values unrelated to the behaviour.`,
  sources: [{ name: "Meszaros, xUnit Test Patterns: General Fixture, Irrelevant Information (in Obscure Test)", url: "http://xunitpatterns.com/Obscure%20Test.html" }],
};
