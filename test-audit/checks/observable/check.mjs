// The observable check: does the test assert behaviour a caller can observe,
// not private internals or internal call order? A "no" raises the
// `implementation-coupled` flag.
//
// Sources:
// - Gerard Meszaros, xUnit Test Patterns (2007): Indirect Testing (in Obscure
//   Test)
//   http://xunitpatterns.com/Obscure%20Test.html
//   A test that checks the code through another object hides what it verifies.
// - Martin Fowler, Mocks Aren't Stubs (2007)
//   https://martinfowler.com/articles/mocksArentStubs.html
//   Behaviour verification checks the calls to a collaborator, not the result
//   that a caller sees.
// - testsmells.org, Open Catalog of Test Smells: Redundant Assertion
//   https://testsmells.org/pages/testsmells.html
//   An assertion that is always true adds no guard.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "observable",
  role: "descriptive",
  flag: "implementation-coupled",
  questions: {
    observable: noul(
      "Does this test assert observable behaviour of the code under test, rather than private internals or internal call order?",
      "it checks behaviour a caller could observe",
      "it checks private internals or internal call order",
    ),
  },
  rubric: `Observable behaviour: output or effects a caller can observe. Private internals,
  call order, and that a mock was called are not observable behaviour.`,
  sources: [
    { name: "Gerard Meszaros, xUnit Test Patterns (2007): Indirect Testing (in Obscure Test)", url: "http://xunitpatterns.com/Obscure%20Test.html" },
    { name: "Martin Fowler, Mocks Aren't Stubs (2007)", url: "https://martinfowler.com/articles/mocksArentStubs.html" },
    { name: "testsmells.org, Open Catalog of Test Smells: Redundant Assertion", url: "https://testsmells.org/pages/testsmells.html" },
  ],
});
