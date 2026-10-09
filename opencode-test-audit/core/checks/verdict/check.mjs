// canonical source: test-audit/checks/verdict/check.mjs@ee14484 sha256:b6a18ccf2bd87820f6fb0370f3a68f6c687d8c51684f12066c082fb527da742f - vendored copy, do not edit here
// The verdict check: overall, is this test a real guard? The tool does not ask
// it. The rules in classifier/verdict.mjs compute it from the answers that carry
// it: slop when the test cannot fail, or its expected value comes from the code
// under test; weak when it checks no exact value, or only a shape, a mock call,
// or its own data, or has no positive assertion; good otherwise. A decision
// model judges one thing per question, so code owns the composition. Its
// calibration cases are the clean tests that must pass, the mixed tests that
// must escalate, and the cases of the smells the battery no longer asks.
//
// Sources:
// - TypeSafe AI, System One docs: "questions describe judgments; code owns
//   composition, thresholds, and side effects"
//   https://docs.typesafe.ai/
// - house rule: the three levels (inference)
//   No source states these levels. They are a synthesis of the sources of the
//   other checks.

/** The verdict levels, lowest first. */
const LEVELS = ["slop", "weak", "good"];

export default /** @satisfies {import("../../types.d.ts").Check} */ ({
  name: "verdict",
  role: "verdict",
  levels: LEVELS,
  questions: {},
});
