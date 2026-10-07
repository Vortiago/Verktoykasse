// The verdict check: overall, is this test a real guard? The answer is a score on
// four levels, defined only by whether it can fail and what it asserts. Slop or
// weak escalates. A descriptive smell does not lower the level, because a
// descriptive check never escalates (ADR 0007). Its calibration cases are the clean tests
// that must pass and the mixed tests that must escalate, because those judge the
// whole verdict, not one smell.
//
// Sources:
// - house rule: the four levels and the cross-question rule (inference)
//   No source states these levels. They are a synthesis of the sources of the
//   other checks.

import { score } from "../../classifier/systemone.mjs";

/** The verdict levels, lowest first. A score answer's value is an index here. */
const LEVELS = ["slop", "weak", "good", "strong"];

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "verdict",
  role: "verdict",
  levels: LEVELS,
  questions: {
    verdict: score("How strong a guard is this test: slop, weak, good, or strong?", LEVELS),
  },
  rubric: `Verdict: slop, weak, good, or strong, by what the assertions check. Slop: it
  asserts nothing, or it cannot fail at all (a tautology, or both sides from the
  code under test). Weak: it asserts only a shape, a mock call, an absence, or its
  own input passed straight through, so it misses most ways the named behaviour
  can break. Good: it asserts a value or effect that the named behaviour decides.
  Strong: good, with an exact expected value that would fail loudly. A value the
  test computes without the code under test, such as a sorted copy of its input,
  is an expected value. No smell from the other definitions lowers the level.`,
});
