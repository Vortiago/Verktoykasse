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
  reason: "does not run, or narrows the run",
  questions: {
    runs_a: noul(
      "Does this test run, with no marker narrowing the run?",
      "yes: no skip, todo, or x marker on it or its describe, and no focus-in-file flag",
      "no: a skip, todo, skipIf, or x marker stops it, or an only or focus marker narrows the file",
    ),
    runs_b: noul(
      "Is this test free of skip, todo, only, and focus markers, in its head, its scope, and its flags?",
      "yes: no such marker",
      "no: a marker is there",
    ),
  },
  negated: [],
});
