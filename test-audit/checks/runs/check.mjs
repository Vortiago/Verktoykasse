// The runs check: does the test run, and does the rest of its file run? A skip,
// todo, or skipIf marker or an x prefix on the test or on a describe around it
// stops it from guarding anything. An only or focus marker anywhere in the file,
// this test included, leaves the other tests out of the run. Asked as a twin pair;
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
    // The model sees one test. `scope` (the describe heads around it) and the
    // `focus-in-file` flag carry the rest of the file, so each phrasing names them.
    runs_a: noul(
      "Does this test run, and does every other test in the file run? Read the test head, the scope field, and the flags field. A skip, todo, or skipIf marker, or an x prefix such as xit or xdescribe, on the test or on a describe around it stops this test. An only or focus marker anywhere in the file, such as it.only, fit, or fdescribe, shows as the flag focus-in-file and leaves other tests out.",
      "this test runs, and no marker in the file leaves another test out",
      "a marker stops this test, or a marker in the file leaves other tests out",
    ),
    // The negated twin of `runs_a`.
    runs_b: noul(
      "Does a marker stop this test or narrow the run? Read the test head, the scope field, and the flags field. A skip, todo, or skipIf marker, or an x prefix such as xit or xdescribe, on the test or on a describe around it stops this test. An only or focus marker anywhere in the file, such as it.only, fit, or fdescribe, shows as the flag focus-in-file and leaves other tests out.",
      "a marker stops this test, or a marker in the file leaves other tests out",
      "this test runs, and no marker in the file leaves another test out",
    ),
  },
  negated: ["runs_b"],
  rubric: `Runs: no skip, todo, or skipIf marker and no x prefix is on the test or on a
  describe in its scope, so the test runs. No only or focus marker is anywhere in
  the file (the flag focus-in-file), so no other test is left out of the run.`,
});
