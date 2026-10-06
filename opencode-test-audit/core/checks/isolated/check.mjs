// canonical source: test-audit/checks/isolated/check.mjs@4ba9d42 sha256:1e25dfb3fa29b9e81efeb45c66b6dbf1b2965b1e870723635de90c27d1fde459 - vendored copy, do not edit here
// The isolated check: does the test pass on its own and in any order, with no
// shared mutable state? A "no" raises the `order-dependent` flag.
//
// Sources:
// - Kent Beck, Test Desiderata (2019): Isolated
//   https://kentbeck.github.io/TestDesiderata/
//   A test gives the same result in any order of the run.
// - Gerard Meszaros, xUnit Test Patterns (2007): Interacting Tests, Test Run
//   War, Unrepeatable Test (in Erratic Test)
//   http://xunitpatterns.com/Erratic%20Test.html
//   Tests that share state or a resource pass or fail by order or by run.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "isolated",
  role: "descriptive",
  flag: "order-dependent",
  questions: {
    isolated: noul(
      "Does this test pass on its own and in any order, with no reliance on shared mutable state or another test?",
      "it is independent of other tests and of run order",
      "it shares state with, or depends on the order of, other tests",
    ),
  },
  rubric: `Isolated: passes on its own and in any order, with no shared mutable state and no
  dependence on another test.`,
});
