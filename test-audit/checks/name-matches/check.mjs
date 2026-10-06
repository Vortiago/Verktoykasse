// The name-matches check: does the test body assert the behaviour its name
// states? A name-only test promises one behaviour and asserts something else or
// something trivial. A "no" raises the `name-mismatch` flag.
//
// Sources:
// - Web Platform Tests, Review Checklist: "The test is testing what it thinks
//   it's testing"
//   https://web-platform-tests.org/reviewing-tests/checklist.html
//   A reviewer checks that the test exercises what its name claims.
// - testsmells.org, Open Catalog of Test Smells: Unknown Test
//   https://testsmells.org/pages/testsmells.html
//   A test that does not show what it verifies hides its purpose.
// - Gerard Meszaros, xUnit Test Patterns (2007): Obscure Test
//   http://xunitpatterns.com/Obscure%20Test.html
//   A reader cannot tell what the test verifies.
// - the house catalogue, verify-prd-implemented/test-patterns.md: Name-only
//   https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md
//   A test named for a behaviour can assert something adjacent and trivial. The
//   name is documentation, not a guard.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "name_matches",
  role: "descriptive",
  flag: "name-mismatch",
  questions: {
    name_matches: noul(
      "Does the test body assert the behaviour its name states?",
      "the body asserts the behaviour the name promises",
      "the name promises one behaviour and the body asserts something else or something trivial",
    ),
  },
});
