// canonical source: test-audit/checks/one-thing/check.mjs@4ba9d42 sha256:1b3ee07751422bd4e7f51084a7a2ffbbf62786fbda1903ca7b8507587be1ebaa - vendored copy, do not edit here
// The one-thing check: does the test check one behaviour, not several unrelated
// behaviours at once? A "no" raises the `eager` flag.
//
// Sources:
// - Gerard Meszaros, xUnit Test Patterns (2007): Eager Test (in Obscure Test
//   and Assertion Roulette)
//   http://xunitpatterns.com/Obscure%20Test.html
//   A test that verifies too much in one method is hard to read and to
//   diagnose.
// - testsmells.org, Open Catalog of Test Smells: Eager Test
//   https://testsmells.org/pages/testsmells.html
//   A test that calls several methods of the object under test is a smell that
//   a tool can find.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "one_thing",
  role: "descriptive",
  flag: "eager",
  questions: {
    one_thing: noul(
      "Does this test check one behaviour, rather than several unrelated behaviours at once?",
      "it checks one behaviour",
      "it is an eager test that checks several unrelated things",
    ),
  },
  rubric: `One behaviour: the body checks one thing, not several unrelated behaviours.`,
});
