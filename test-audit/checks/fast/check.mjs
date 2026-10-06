// The fast check: does the test run in milliseconds, with no sleep, heavy I/O, or
// large computation? A "no" raises the `slow` flag.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "fast",
  role: "descriptive",
  flag: "slow",
  questions: {
    fast: noul("Does the test run fast, with no sleep, no heavy I/O, and no large computation?", "it runs fast", "it sleeps, waits, or does heavy work"),
  },
  rubric: `Fast: the test runs in milliseconds, with no sleep, heavy I/O, or large computation.`,
  sources: [
    { name: "Kent Beck, Test Desiderata (Fast)", url: "https://kentbeck.github.io/TestDesiderata/" },
    { name: "Meszaros, xUnit Test Patterns: Slow Tests, Sleepy Test", url: "http://xunitpatterns.com/" },
    { name: "testsmells.org, Open Catalog of Test Smells: Sleepy Test", url: "https://testsmells.org/pages/testsmells.html" },
  ],
};
