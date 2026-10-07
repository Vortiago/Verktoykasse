// canonical source: test-audit/checks/runs/check.mjs@aa397d5 sha256:ecd99521001cb25690eec8f12b598c29001550287c8f8e152d64181847e67977 - vendored copy, do not edit here
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
      "Does this test run, with no marker in the file narrowing the run?",
      "it runs, and nothing narrows the run",
      "a marker stops it or narrows the run",
    ),
    runs_b: noul(
      "Does a marker stop this test or narrow the run?",
      "a marker stops it or narrows the run",
      "it runs, and nothing narrows the run",
    ),
  },
  negated: ["runs_b"],
  rubric: `Runs: read the test head, the scope field, and the flags field. A skip, todo, or
  skipIf marker, or an x prefix such as xit or xdescribe, on the test or on a
  describe around it stops the test. An only or focus marker anywhere in the file,
  such as it.only, fit, or fdescribe, shows as the flag focus-in-file and narrows
  the run.`,
});
