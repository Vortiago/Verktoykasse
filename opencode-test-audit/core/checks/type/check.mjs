// canonical source: test-audit/checks/type/check.mjs@9ae1caa sha256:19a428696851c46ab712515f0efc79bf6e76f77d7022598c198445ed16068407 - vendored copy, do not edit here
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
    // The kinds mix two axes, scope and purpose, so the instruction gives the
    // order in which they decide: purpose first, then scope.
    type: choice(
      "What type of test is this? If the name cites a bug or an issue, answer regression. If the test pins current output as a baseline before a change, answer characterization. If it only checks that something runs or exists, answer smoke. Otherwise answer by scope: unit, integration, or e2e.",
      {
        unit: "one small unit in isolation, with its collaborators mocked or absent",
        integration: "several units together, such as code with a real database, filesystem, or module",
        regression: "the name cites a past bug or issue that the test keeps from returning",
        e2e: "drives the whole system through its public interface",
        smoke: "only checks that something runs or exists, at a coarse level",
        characterization: "pins current output as a baseline before a change",
      },
    ),
  },
  rubric: `Type: regression, characterization, or smoke by purpose first; otherwise unit,
  integration, or e2e by what it exercises.`,
});
