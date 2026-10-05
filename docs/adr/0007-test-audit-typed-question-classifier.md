# 0007: test-audit asks typed SystemOne questions and trusts mass plus a paraphrase spread

- Status: Accepted
- Date: 2026-10-05
- Deciders: Atle

## Context

AI writes most tests now, and a green suite hides the vacuous one. Coverage
numbers say a line ran; they do not say a test can fail. `verify-prd-implemented`
proves a guard by mutation, but that is too slow to run on every change.

A Jev-compatible typed one-token question endpoint answers this need:
`POST {base}/v1/systemone`. It answers `noul` (yes/no), `choice` (pick one), and
`score` (an ordinal) over one shared read of a `state`. Some servers add `mass`
to each answer, the share of the softmax the allowed answers held before the
grammar. `confidence` is a margin against the runner-up, and is not calibrated.

A probe showed the failure a single question misses: one phrasing of "can this
test fail" called a tautology falsifiable at 0.92 with mass 0.99, while its
logically equivalent twins answered 0.00 and 0.11. High mass, high margin,
wrong.

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
  several servers and models side by side. A missing `mass` is trusted: the
  paraphrase spread and the cross-question rule then carry the trust, and the
  report says so.
- **Trust is `mass` plus a paraphrase spread.** Each verdict-carrying question
  is asked in more than one logically equivalent phrasing, polarity normalised.
  An answer is trusted when `mass >= minMass`; the judgment is stable when the
  spread across phrasings is inside a band. The `asserts` gate also swaps its
  answer order between phrasings, as a position control. `confidence` is read
  as a margin, never as a probability of correctness.
- **An untrusted or unstable verdict escalates.** A hard static flag, an
  unanswered or unstable `can_fail`, disagreeing `asserts`, or a `slop`/`weak`
  verdict marks the test `needs-eyes`. A disagreement is never tie-broken by a
  third phrasing: the safe default is a human, because a silent pass is the
  failure this tool exists to catch. Descriptive gates (`type`,
  `deterministic`, `one_thing`, `name_matches`) report and do not escalate.
- **The tool is an inferential sensor, not a proof.** It never runs mutations in
  v1. It may suspect `passes-for-the-wrong-reason`; it never claims to prove it.
  `verify-prd-implemented` keeps the mutation check.
- **v1 is JS/TS behind one extractor seam.** The parse half takes a file's text,
  so node:test, vitest, and jest share one extractor. Pester and pytest plug
  into the same seam later.
- **v1 is manual plus an OpenCode plugin, both advisory.** There is no
  git-commit event and no deny decision on plugin hooks, so nothing can block
  yet. A blocking pre-push hook waits until the corpus calibration holds.
- **The calibration corpus is the evidence.** `cli.mjs --selftest` runs labelled
  fixtures against a live endpoint. The hard rules are: no labelled slop case
  passes silently, and every mixed case routes to eyes. `can_fail` agreement is
  measured only where the tool committed to a value; an unstable case that
  routed is the design working.

## Consequences

- A change that asks for a verdict pays one call per added test, plus one token
  per question.
- The paraphrase pair is the whole reason a high-`mass` wrong answer surfaces.
  A future gate should be added only with a twin, or the probe's miss returns.
- The `asserts` order swap is a control, not a second opinion: the two answers
  are compared by key, so reordering must not change the choice.
- The corpus can only be run live, so `--selftest` is outside the repo gate. The
  results live in `test-audit/BENCHMARK.md` and are re-recorded when the model or
  a phrasing changes.
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
  over unstable judgments invents certainty. Disagreement is the signal; it
  routes.
- **Round-trip the same question to a larger model as a judge.** Rejected:
  it moves the call off the cheap path and makes the tool cost what the
  mutation check already costs.
- **Run the mutation check per change.** Rejected as the default: it is the
  proof, not the screen, and it is too slow for the loop a sensor belongs in.
- **Flag every descriptive gate.** Rejected: a wrong `type` label is low-harm,
  and escalating it would drown the human queue that the real slop needs.
- **A generic regex extractor for every language in v1.** Rejected: a low
  precision extractor feeds the model nonsense and the verdicts read as noise.
  JS/TS first, behind the seam, keeps every later language honest.

## Notes

The acceptance rules, not the numbers, are the contract. Recorded runs, with the
per-test results, live in `test-audit/BENCHMARK.md`.
