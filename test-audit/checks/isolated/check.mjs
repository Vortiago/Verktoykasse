// The isolated check: does the test pass alone and in any order, reading nothing
// that another test sets or changes? A hook, or a fixture no test changes, is
// fine. It is about what the test reads;
// `restores` is about what it leaves. A "no" raises the `order-dependent` flag.
//
// Sources:
// - Kent Beck, Test Desiderata (2019): Isolated
//   https://kentbeck.github.io/TestDesiderata/
//   A test gives the same result in any order of the run.
// - Gerard Meszaros, xUnit Test Patterns (2007): Interacting Tests,
//   Unrepeatable Test (in Erratic Test)
//   http://xunitpatterns.com/Erratic%20Test.html
//   Tests that share state or a resource pass or fail by order or by run.

import { noul } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "isolated",
  role: "descriptive",
  flag: "order-dependent",
  questions: {
    isolated: noul(
      "Does this test pass alone and in any order, reading nothing another test sets or changes?",
      "yes: what it reads is built by it, a hook, or a fixture no test changes",
      "no: it reads a value another test sets or changes",
    ),
  },
});
