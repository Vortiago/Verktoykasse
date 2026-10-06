// canonical source: test-audit/checks/verdict/check.mjs@9ae1caa sha256:7276ef0c247b3a10dc200b5db0641fa2028179d28bec73e8c9d859a7f147789a - vendored copy, do not edit here
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
    // The levels use only the axes that decide a guard. A descriptive smell
    // never escalates, so it must not lower the level either: a flaky but real
    // guard is good, with its flags.
    verdict: score(
      "Overall, is this test a real guard? Slop: it asserts nothing, or it cannot fail at all, such as a tautology or two sides that both come from the code under test. Weak: it asserts only a shape, a mock call, an absence, or its own input, so it misses most ways the named behaviour can break. Good: it asserts a value or effect that the named behaviour decides. Strong: good, with an exact expected value that would fail loudly. A smell from the other definitions, such as slow, flaky, uncontrolled, a vague name, a magic number, or a state leak, does not lower the level.",
      LEVELS,
    ),
  },
  rubric: `Verdict: slop, weak, good, or strong. Slop: it asserts nothing, or it cannot fail
  at all (a tautology, or both sides from the code under test). Weak: it asserts
  only a shape, a mock call, an absence, or its own input, so it misses most ways
  the named behaviour can break. Good: it asserts a value or effect that the named
  behaviour decides. Strong: good, with an exact expected value that would fail
  loudly. Slow, flaky, uncontrolled, vague-name, magic-number, and state-leak smells
  do not lower the level.`,
});
