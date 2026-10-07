// The runs check: does the test run, and does the rest of its file run? A skip,
// todo, or skipIf marker or an x prefix on the test or on a describe around it
// stops it from guarding anything. An only or focus marker anywhere in the file
// leaves the other tests out of the run. The tool asks no question: the
// extractor reads the markers and sets the `skipped` and `focus-in-file` flags,
// and the rules read those. A marker is syntax, so it is a fact, not a judgement.
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

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "runs",
  role: "runs",
  reason: "does not run, or narrows the run",
  questions: {},
});
