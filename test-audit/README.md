# test-audit

A SystemOne classifier for the tests a change adds. It asks any Jev-compatible
typed-question endpoint the questions a reviewer asks, one verdict per test, and
routes slop and unstable judgments to a human.

It answers one question cheaply: *is this test a real guard, or fake safety?*
It is an inferential sensor. It does not prove coverage. The mutation check in
[`verify-prd-implemented`](../verify-prd-implemented/SKILL.md) stays the proof.

## What it does

```
git diff (base..head, the index, or the working tree)
  -> collect.mjs   read the diff and the touched files
  -> extract.mjs   find the test blocks (JS/TS)
  -> smells.mjs    static flags that need no model
  -> gates.mjs     one SystemOne call per test, the whole battery batched
  -> report.mjs    per-test verdict, summary, exit code
```

Trust is `mass` (was the model answering at all) plus the paraphrase spread
(does the judgment survive rewording). An untrusted or unstable
verdict-carrying answer escalates the test. A silent pass is the failure this
tool hunts, so escalation is the only safe default.

### The battery

| Question | Type | Looks for |
| --- | --- | --- |
| `can_fail_a` | yes/no | tautology, vacuous, passes-with-zero |
| `can_fail_b` | yes/no, negated twin | the same judgment, asked the other way |
| `can_fail_c` | yes/no | the same judgment, phrased directly |
| `asserts_a` | choice | behaviour, hardcoded data, shape only, interaction only, nothing |
| `asserts_b` | choice, order swapped | position control for `asserts_a` |
| `type` | choice | unit, integration, regression, e2e, smoke, characterization |
| `observable` | yes/no | implementation coupling: private internals, call order, exact collaborator interactions |
| `conditional` | yes/no | conditional test logic: a branch, loop, or catch can leave the assertion unrun |
| `isolated` | yes/no | interacting tests, test-run war, shared mutable state, order dependence |
| `controlled` | yes/no | resource optimism and mystery guest: an assumed network, clock, filesystem, or environment |
| `specific` | yes/no | a weak assertion where the most specific one is possible |
| `named` | yes/no | an obscure test: a vague name that states no behaviour or result |
| `deterministic` | yes/no | sleep, time, network, order dependence |
| `one_thing` | yes/no | eager test: several unrelated behaviours in one body |
| `name_matches` | yes/no | name-only test: the body asserts something other than the name |
| `verdict` | score | slop, weak, good, strong |

The three `can_fail_*` phrasings are logically equivalent and polarity
normalised. A spread above `TEST_AUDIT_STABLE_BAND` is instability, not a tie to
break, so the test routes to a human instead of taking a coin-flip answer.

The `can_fail_*` answers, the `asserts_*` pair, and `verdict` carry the verdict.
Every other question reports as a flag and never escalates alone.

### What the model sees

One audit asks all 16 questions about one test in a single call. The shared
`state` holds three parts: the rubric (the definitions above, so the model knows
what each concept means), the test record (`file`, `path`, `name`, `source`,
`fixtures`, `imports`), and a capped slice of the non-test diff. Each question
adds only its own `instructions` and the `criteria` that say what each answer
means, for example `{"true": "a change can make it fail", "false": "no change can
make it fail"}`. The reply carries `probabilities` and `confidence`, and, on a
server that reports it, `mass`.

### Static flags

`skipped` / `focused`, an empty body, no assertion at all, and a commented-out
assertion escalate without a model call. `roulette` (several assertions, no
message) is informational. The descriptive gates raise
`implementation-coupled`, `conditional`, `order-dependent`,
`uncontrolled-resource`, `weak-assert`, `vague-name`, `non-deterministic`,
`eager`, and `name-mismatch`; those report and do not escalate.

### Endpoints and models

The client speaks the Jev SystemOne API, so any implementation works:

- **Ollama 0.35 or later**, the default at `http://127.0.0.1:11434`, which
  serves `/v1/systemone` for local decision models such as `nimble` and `tev1`,
  and `clef` / `clef-flash` with vision. Ollama rejects cloud models on this
  endpoint, so pull the decision model first. It reports no `mass`.
- **[llama-arbiter](https://github.com/Vortiago/llama-arbiter)**, a decision
  server for Jev-compatible models. It reports `mass` on each answer.
- **Ollaya** and any other TypeSafe-compatible server, at its own base URL.

Point at one with `--url` and `--model`, or compare several on the corpus with
`--targets`. A target is `url|model`, or a bare `model` on the configured URL.

## Use

```sh
node test-audit/cli.mjs                     # the working tree against the default branch
node test-audit/cli.mjs --base main         # the merge base of main and HEAD
node test-audit/cli.mjs --staged            # the staged change
node test-audit/cli.mjs --files a.test.mjs  # named files
node test-audit/cli.mjs --json              # the full record
node test-audit/cli.mjs --markdown          # a review comment
node test-audit/cli.mjs --url http://127.0.0.1:11434 --model nimble   # an Ollama decision model
node test-audit/cli.mjs --selftest          # live calibration over corpus/
node test-audit/cli.mjs --selftest --targets "http://127.0.0.1:11434|nimble, http://127.0.0.1:11435|winnow:e4b"
node test-audit/cli.mjs --selftest --models "nimble,tev1"   # several models on one URL
node test-audit/cli.mjs --selftest --benchmark   # per-test results, in markdown
```

Exit code `0` means every test was classified and none needs eyes. Exit `1`
means a test is slop, weak, or unstable. Exit `2` means a usage or transport
failure. A transport failure is an audit failure, not a skip.

## Config

| Variable | Default | Meaning |
| --- | --- | --- |
| `TEST_AUDIT_SYSTEMONE_URL` | `http://127.0.0.1:11434` | SystemOne base |
| `TEST_AUDIT_MODEL` | `nimble` | the decision model |
| `TEST_AUDIT_MIN_MASS` | `0.5` | trust floor, when the endpoint reports `mass` |
| `TEST_AUDIT_STABLE_BAND` | `0.25` | paraphrase spread ceiling |
| `TEST_AUDIT_CONCURRENCY` | `3` | calls in flight |
| `TEST_AUDIT_TIMEOUT_MS` | `120000` | per call |
| `TEST_AUDIT_STATE_CAP` | `8000` | characters per test state |
| `TEST_AUDIT_CHANGE_CAP` | `3000` | characters of non-test diff context |

## Calibration

`node cli.mjs --selftest` runs the labelled corpus in `corpus/` against the
configured endpoint and reports agreement. The corpus draws on the house
bad-test catalogue and the wider literature: a case for each named defect, clean
tests of the common types, and deliberately mixed cases whose expected outcome
is escalation.

A case that routes as unstable is not scored for agreement: the tool did not
commit to a value, it escalated. Re-run the selftest whenever the model or a
phrasing changes, and record the run in [`BENCHMARK.md`](BENCHMARK.md).

## References

What each question looks for, and the source behind it. The full annotated list,
including which claims are primary and which are house inferences, is in
[`references.md`](references.md).

| Looking for | Grounded in |
| --- | --- |
| Falsifiability (`can_fail_*`) | Beck, *Test Desiderata* (`Behavioral`); WPT review checklist, "fails when it's supposed to fail"; Meszaros, `Erratic Test`; the mutation-testing literature |
| Assertion target (`asserts_*`) | testsmells.org, Open Catalog of Test Smells (`Redundant Assertion`, `Unknown Test`, `Sensitive Equality`, `Magic Number Test`); Meszaros, `Obscure Test`; Fowler, "Mocks Aren't Stubs" |
| Implementation coupling (`observable`) | Meszaros, `Indirect Testing`; Fowler, "Mocks Aren't Stubs"; testsmells.org, `Redundant Assertion` |
| Conditional logic (`conditional`) | Meszaros, `Conditional Test Logic`; testsmells.org, `Conditional Test Logic` |
| Isolation (`isolated`) | Beck, `Isolated`; Meszaros, `Interacting Tests`, `Test Run War`, `Unrepeatable Test` |
| Controlled resources (`controlled`) | Meszaros, `Resource Optimism`, `Mystery Guest`; testsmells.org, `Mystery Guest` |
| Specific assertion (`specific`) | WPT checklist, "the most specific asserts possible"; testsmells.org, `Sensitive Equality` |
| Vague name (`named`) | Meszaros, `Obscure Test`; testsmells.org, `Unknown Test` |
| Test type (`type`) | Meszaros, `Test Organization`; Feathers, characterization testing. The six labels are house choice |
| Determinism (`deterministic`) | Beck, `Deterministic` and `Isolated`; Meszaros, `Erratic Test`; testsmells.org, `Sleepy Test` and `Mystery Guest` |
| Eager test (`one_thing`) | Meszaros, `Eager Test`; testsmells.org, `Eager Test` |
| Name matches body (`name_matches`) | WPT checklist, "testing what it thinks it's testing"; testsmells.org, `Unknown Test`; the house catalogue |
| Cross-question contradiction (`verdict`) | a house rule, inferred from the sources |
| Escalate, never tie-break | Böckeler, "Maintainability sensors for coding agents" |
| Paraphrase pair and position swap | self-consistency (Wang et al. 2023); MT-Bench and "not Fair Evaluators" on position bias |
| The house defect catalogue | [`verify-prd-implemented/test-patterns.md`](../verify-prd-implemented/test-patterns.md) |

## Honest limits

- Paraphrase agreement is necessary, not sufficient. Correlated errors still
  pass. The corpus and the escalation path carry that risk.
- `passes-for-the-wrong-reason` is provable only by the mutation check. The
  audit can suspect it (an interaction-only assertion, a remote fixture); it
  cannot prove it.
- When the endpoint reports no `mass` (Ollama), the trust floor cannot apply, so
  the paraphrase spread and the cross-question rule are the only guards.
- The tool judges tests, not coverage. It never says a change is sufficiently
  tested, only that each added test is a real guard.
- The extractor reads `test`/`it` calls with a literal or computed name, folds a
  `test.each` table into one test, and flags a computed name. The tagged-template
  form (`test.each` with a backtick) and the generic form (`test.each<T>`) are
  not matched.
- The core modules are `.mjs` and sit outside the `tsc` gate, as
  `searx-researcher/server` does: they import `node:*` and the gate carries no
  `@types/node`. The `node --test` suite is their guard.

## Layout

```
cli.mjs        argument parsing and output
audit.mjs      the pipeline, shared with the plugin
collect.mjs    git diff and file reads          [the read half]
extract.mjs    test detection and extraction    [the parse half]
code.mjs       the code-only view (comments, strings, regex blanked)
smells.mjs     static flags, no model
gates.mjs      the battery and the verdict rules
report.mjs     text, json, markdown, exit codes
systemone.mjs  the typed-question client
config.mjs     TEST_AUDIT_* defaults
pool.mjs       bounded concurrency
corpus.mjs     the live calibration runner
corpus/        labelled fixtures and labels (labels/ holds one fragment per defect family)
BENCHMARK.md   recorded calibration runs and per-test results
references.md  the sources behind each question
types.d.ts     the shared shapes, and the tsc gate's input
tools/check.mjs  the gate command (from vanilla-web)
tools/js-scan.mjs  the scanner helpers it shares
```

The OpenCode plugin lives in [`../opencode-test-audit`](../opencode-test-audit/README.md).
