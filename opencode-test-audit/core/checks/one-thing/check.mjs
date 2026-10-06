// canonical source: test-audit/checks/one-thing/check.mjs@9ae1caa sha256:baab452884b5f5d6eb4174f5c9424da22a1e59f484518f1c6b3e96138b0a9ccc - vendored copy, do not edit here
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
      "Does this test check one behaviour, rather than several unrelated behaviours at once? Several assertions on one result count as one behaviour. Several actions on different units, each with its own assertion, count as several.",
      "it checks one behaviour",
      "it is an eager test that checks several unrelated behaviours",
    ),
  },
  rubric: `One behaviour: the body checks one thing. Several assertions on one result are
  one behaviour; several actions on different units are several.`,
});
