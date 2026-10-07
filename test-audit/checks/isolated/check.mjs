// The isolated check: does the test read only what it or a before-each hook
// builds, so it passes alone and in any order? It is about what the test reads;
// `restores` is about what it leaves. A "no" raises the `order-dependent` flag.
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
      "Does this test read only values that it builds itself, or that a hook in fixtures builds before each test? Answer no when it reads a value that another test must set, or mutable state in setup that is shared with other tests and that no hook resets. An object the file declares once, such as a registry, that this test reads but another test fills, is shared state.",
      "it builds what it reads, so it passes alone and in any order",
      "it reads state that another test sets, or mutable state shared with other tests",
    ),
  },
  rubric: `Isolated: the test reads only what it or a before-each hook builds, so it passes
  alone and in any order. Isolated is about what the test reads; Restores state
  is about what it leaves.`,
});
