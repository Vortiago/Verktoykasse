// The type check: what kind of test is this, by what it actually exercises? The
// report shows the answer. It never escalates, because a wrong label does little
// harm (ADR 0007).
//
// Sources:
// - Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test
//   Strategy
//   http://xunitpatterns.com/
//   The book sorts tests by scope, which grounds the labels unit, integration,
//   and end-to-end.
// - Michael Feathers, Characterization Testing (2016)
//   https://michaelfeathers.silvrback.com/characterization-testing
//   A characterization test pins the current behaviour before a change.
// - house choice: the exact six labels (inference)
//   No source names these six labels. A wrong label does little harm, so the
//   type never escalates.

import { choice } from "../../classifier/systemone.mjs";

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "type",
  role: "type",
  questions: {
    type: choice("What type of test is this?", {
      unit: "one small unit in isolation, with its collaborators mocked or absent",
      integration: "several units together, such as code with a real database, filesystem, or module",
      regression: "reproduces a specific past bug so it cannot return",
      e2e: "drives the whole system through its public interface",
      smoke: "only checks that something runs or exists, at a coarse level",
      characterization: "pins current behaviour as a baseline before a change",
    }),
  },
  rubric: `Type: unit, integration, regression, e2e, smoke, or characterization, by what it
  actually exercises.`,
});
