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

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "runs",
  role: "gate",
  // A skip or todo stops this test; an only or focus marker, on this test or
  // another, stops the rest of the file. Both escalate, under one reason.
  reason: "does not run, or narrows the run",
  questions: {
    // `scope` (the describe heads around the test) and the `focus-in-file` flag
    // in the state are what let the model answer the "around it" parts.
    runs_a: noul(
      "Does the whole file run as written? There is no skip or todo marker on this test or on a describe around it, and no only or focus marker on any test or describe in the file, this one included.",
      "this test runs, and no marker stops another test in the file from running",
      "a skip or todo stops this test, or an only or focus marker stops other tests",
    ),
    // The negated twin of `runs_a`.
    runs_b: noul(
      "Does a marker change what runs? Look for a skip or todo marker on this test or on a describe around it, and an only or focus marker on any test or describe in the file, this one included.",
      "a skip or todo stops this test, or an only or focus marker stops other tests",
      "this test runs, and no marker stops another test in the file from running",
    ),
  },
  negated: ["runs_b"],
  rubric: `Runs: no skip or todo marker is on the test or on a describe around it, so the
  test runs. No only or focus marker is anywhere in the file, on this test or
  another, so no other test is left out of the run.`,
});
