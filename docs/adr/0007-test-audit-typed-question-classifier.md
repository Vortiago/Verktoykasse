# 0007: test-audit asks typed SystemOne questions and trusts mass plus a paraphrase spread

- Status: Accepted
- Date: 2026-10-05
- Deciders: Atle

## Context

AI writes most tests now, and a green suite hides the vacuous test. Coverage
numbers say a line ran. They do not say a test can fail.
`verify-prd-implemented` proves a guard by mutation, but that is too slow to run
on every change.

A Jev-compatible typed one-token question endpoint answers this need:
`POST {base}/v1/systemone`. It answers `noul` (yes/no), `choice` (pick one), and
`score` (an ordinal) over one shared read of a `state`. Some endpoints add `mass`
to each answer. `mass` is the share of the model's probability that the allowed
answers held before the grammar. `confidence` is a margin against the runner-up,
and is not calibrated.

A probe showed the failure a single question misses. One phrasing of "can this
test fail" called a tautology falsifiable at 0.92 with mass 0.99. Its two
logically equivalent twins answered 0.00 and 0.11. The answer had a high mass and
a high margin, and it was wrong.

## Decision

- **The classifier is typed SystemOne questions.** One `test-audit` call asks
  the whole battery about one test, so the state is read once and each question
  costs one token. The battery names its sources: Beck's Test Desiderata,
  Meszaros, testsmells.org, the WPT review checklist, and the house catalogue in
  `verify-prd-implemented/test-patterns.md`.
- **A shared rubric travels with every test.** The state opens with the
  definitions the questions assume: falsifiable, observable behaviour,
  conditional logic, isolation, controlled resources, specificity, and the
  verdict levels. A question alone asks the model to guess what "falsifiable" or
  "implementation coupling" means. The rubric is grounded in the same sources and
  costs one read per test.
- **The client speaks any Jev-compatible endpoint**, so the corpus can score
  several endpoints and models side by side. The tool trusts a missing `mass`.
  The paraphrase spread and the cross-question rule then carry the trust, and the
  report says so.
- **Trust is `mass` plus a paraphrase spread.** The tool asks each
  verdict-carrying question in more than one logically equivalent phrasing, and
  it normalises their polarity. The tool trusts an answer when `mass >= minMass`.
  The judgement is stable when the spread across phrasings is inside a band. The
  `asserts` gate also swaps its answer order between phrasings, as a position
  control. The tool reads `confidence` as a margin, never as a probability of
  correctness.
- **An untrusted or unstable verdict escalates.** A `runs` pair that says no, a
  `positive` pair that says no, a pair whose twins disagree, an unanswered or unstable `can_fail`, an `asserts`
  answer that is not `behaviour`, or a `slop`/`weak` verdict marks the test
  `needs-eyes`. The tool never tie-breaks a disagreement
  with a third phrasing. A human decides, because a silent pass is the failure
  this tool exists to catch. The descriptive questions report and do not
  escalate.
- **The tool does no static analysis of the test source.** A rule for one
  runner's assertion or skip method does not fit the next runner, so `runs` and
  the rest of the battery read the source and judge the intent, and the same
  battery works across frameworks. The one syntactic read is finding the test
  blocks.
- **The tool is a cheap sensor, not a proof.** It never runs mutations in the
  first version. It may suspect `passes-for-the-wrong-reason`, and it never
  claims to prove it. `verify-prd-implemented` keeps the mutation check.
- **The first version covers JavaScript and TypeScript behind one extractor
  seam.** The parse half takes a file's text, so node:test, vitest, and jest
  share one extractor. Pester and pytest plug into the same seam later.
- **The first version is manual plus an OpenCode plugin, both advisory.** There
  is no git-commit event and no deny decision on plugin hooks, so nothing can
  block yet. A blocking pre-push hook waits until the corpus calibration holds.
  The plugin lives in `opencode-test-audit/` and installs from
  `path:opencode-test-audit`. OpenCode installs only the `path:` directory, so
  the plugin cannot import `../test-audit` at run time. It carries a stamped
  copy of the core modules in `core/`, synced by `sync-from-test-audit.sh` and
  checked for drift in CI, as ADR 0001 does for the vanilla-web toolkit.
- **The calibration corpus is the evidence.** `cli.mjs --selftest` runs labelled
  fixtures against a live endpoint. Two rules are hard. No labelled slop test
  passes silently, and every mixed test escalates. The tool measures `can_fail`
  agreement only where it committed to a value. When an unstable case routes to a
  human, the design works.

## Consequences

- A change that asks for a verdict pays one call per added test, plus one token
  per question.
- The paraphrase pair is the whole reason a high-`mass` wrong answer surfaces.
  Add a future gate only with a twin, or the probe's miss returns.
- The `asserts` order swap is a control, not a second opinion. The tool compares
  the two answers by key, so reordering must not change the choice.
- The corpus runs only live, so `--selftest` is outside the repo gate. The
  results live in `test-audit/BENCHMARK.md`, and the tool records them again when
  the model or a phrasing changes.
- A gate model swap is not transparent: the thresholds (`minMass`,
  `stableBand`) and the phrasings are calibrated to one model. The selftest is
  the tripwire.
- A per-test gate cannot judge duplication across tests: that needs the whole
  file, so a `duplicate` gate is left out rather than guessed from one test.

## Alternatives considered

- **One phrasing per question, trust `mass` and `confidence`.** Rejected: the
  probe's tautology passed at mass 0.99. `mass` catches grammar-forcing, not a
  confident wrong answer.
- **A third phrasing as a tie-breaker on disagreement.** Rejected: a majority
  over unstable judgements invents certainty. Disagreement is the signal. It
  routes to a human.
- **Round-trip the same question to a larger model as a judge.** Rejected:
  it moves the call off the cheap path and makes the tool cost what the
  mutation check already costs.
- **Run the mutation check per change.** Rejected as the default: it is the
  proof, not the screen, and it is too slow for the loop a sensor belongs in.
- **Flag every descriptive gate.** Rejected: a wrong `type` label is low-harm,
  and escalating it would drown the human queue that the real slop needs.
- **A generic regex extractor for every language in the first version.** Rejected: a low
  precision extractor feeds the model nonsense and the verdicts read as noise.
  JavaScript and TypeScript first, behind the seam, keeps every later language honest.

## Notes

The acceptance rules, not the numbers, are the contract. Recorded runs, with the
per-test results, live in `test-audit/BENCHMARK.md`.

## Amendment, 2026-10-07: decision-model style, and findings for an LLM

The reader of an audit is an LLM that decides which tests to look at, fix, or
drop. So the tool is short, terse, as reliable as possible, and fast. A silent
pass is the one expensive failure; a false positive is cheap when the finding
says it is unsure. Two decisions above change to fit how a decision model is
meant to be used (TypeSafe AI, System One docs, https://docs.typesafe.ai/):

- **No shared rubric.** The state is the test record and the diff slice.
  Accuracy falls as the state grows with text unrelated to a decision, so each
  question carries its own one-line definition in its criteria.
- **No negated twin.** A decision model answers a negation less reliably, and a
  yes/no question leans toward the proposition it is handed. Each
  verdict-carrying check asks its judgement in two plain phrasings; a spread
  above the band still escalates. `asserts` keeps its order swap and gains an
  `unclear` option, which escalates.

And these follow:

- **The verdict is computed, not asked.** A score is the weakest question type,
  and the verdict depends only on the other answers. Code owns the
  composition: slop, weak, or good. "Cannot fail" beside a behaviour assertion
  is a contradiction, and escalates. `type` is dropped: it changed no action.
- **The battery asks only what changes the action.** The 13 cosmetic or
  overlapping smell checks are gone; flaky, order-dependent, state leak,
  conditional logic, and manual stay.
- **The report is one finding per test**: drop, fix, or look, the reasons, and
  "sure" or "unsure, possibly a false positive" (`classifier/finding.mjs`).
