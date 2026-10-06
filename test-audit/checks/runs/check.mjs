// The runs check: does the test run at all? A skip, todo, only, or focus marker
// on the test or on a describe around it, or an only or focus marker on another
// test in the file, stops it from guarding anything. Asked as a twin pair;
// `runs_b` is the negated twin.
//
// The twin rule and its sources are in classifier/verdict.mjs.
//
// Sources:
// - testsmells.org, Open Catalog of Test Smells: Ignored Test
//   https://testsmells.org/pages/testsmells.html
//   A test that is marked to be ignored does not run, so it guards nothing.
// - the house catalogue, verify-prd-implemented/test-patterns.md: Skipped /
//   disabled / focused
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
//   A skip, an xit, an it.only elsewhere in the file, or an early return
//   narrows the run.

import { noul } from "../../classifier/systemone.mjs";

/** @type {import("../../types.d.ts").Check} */
export default {
  name: "runs",
  role: "gate",
  reason: "does not run",
  questions: {
    // `scope` (the describe heads around the test) and the `focus-in-file` flag
    // in the state are what let the model answer the "around it" parts.
    runs_a: noul(
      "Is this test free of markers that change whether it runs? Check the test, each describe around it, and the other tests in the file.",
      "no skip, todo, only, or focus marker affects it",
      "a skip, todo, only, or focus marker affects it",
    ),
    // The negated twin of `runs_a`.
    runs_b: noul(
      "Is there a skip, todo, only, or focus marker on this test or on a describe around it, or an only or focus marker on another test in the file?",
      "a marker changes whether it runs",
      "no marker changes whether it runs",
    ),
  },
  negated: ["runs_b"],
  rubric: `Runs: no skip, todo, only, or focus marker is on the test or on a describe
  around it, and no only or focus marker is on another test in the file.`,
  sources: [
    { name: "testsmells.org, Open Catalog of Test Smells: Ignored Test", url: "https://testsmells.org/pages/testsmells.html" },
    { name: "the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused", url: "https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md" },
  ],
};
