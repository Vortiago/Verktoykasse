// The observable check: does the assertion read an output or effect a caller of
// the public interface could see, not a private field, an internal helper call,
// or internal call order? It is about what is asserted; `resilient` is about how
// the code is reached. A "no" raises the
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
      "Does the assertion read an output or an effect that a caller of the public interface could see? A return value, a thrown error, a change the caller can read back, or a message sent through an injected port is observable. A private field, an underscore member, an internal helper call, or the order of internal calls is not.",
      "it asserts an output or effect a caller could see",
      "it asserts a private internal, an internal helper call, or internal call order",
    ),
  },
  rubric: `Observable behaviour: a return value, a thrown error, a change the caller can
  read back, or a message sent through an injected port. A private field, an
  internal helper call, or the order of internal calls is not observable.`,
});
