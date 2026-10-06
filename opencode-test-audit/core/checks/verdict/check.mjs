// canonical source: test-audit/checks/verdict/check.mjs@4ba9d42 sha256:d1cea9e98c090f71178c3f2169c6c88e4456293c285e498897ae418355cdb631 - vendored copy, do not edit here
// The verdict check: overall, is this test a real guard? The answer is a score on
// four levels. Slop or weak escalates. Its calibration cases are the clean tests
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
    verdict: score(
      "Overall, is this test a real guard against the behaviour it names? Weigh whether it can fail, what it asserts, and every smell the earlier questions name. It is a real guard only if it can fail when that behaviour breaks.",
      LEVELS,
    ),
  },
  rubric: `Verdict: slop, weak, good, or strong. Slop is no real guard; weak is a guard with
  a serious smell; good is a real guard; strong is a real guard with a specific
  expected value that would fail loudly.`,
});
