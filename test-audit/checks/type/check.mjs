// The type check: what kind of test is this? Purpose decides first (regression,
// characterization, smoke), then scope (unit, integration, e2e). The
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
      unit: "one unit, collaborators mocked or absent",
      integration: "several real units together",
      regression: "the name cites a past bug or issue",
      e2e: "the whole system through its public interface",
      smoke: "only that something runs or exists",
      characterization: "pins current output before a change",
    }),
  },
  rubric: `Type: by purpose first. regression: the name cites a bug or an issue.
  characterization: it pins current output as a baseline before a change. smoke: it
  only checks that something runs or exists. Otherwise by scope: unit (one unit,
  collaborators mocked or absent), integration (several units with a real
  database, filesystem, or module), or e2e (the whole system through its public
  interface).`,
});
