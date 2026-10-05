# test-audit

test-audit checks the tests that a change adds. For each test, it asks a
SystemOne endpoint the questions a reviewer asks, then prints one verdict per
test. A test that needs a closer look goes to a human.

The tool is a cheap sensor. It separates real guards from fake safety. It does
not prove that a change is tested. For that proof, use
[`verify-prd-implemented`](../verify-prd-implemented/SKILL.md). That skill breaks
the behaviour of the code and checks that the named test fails.

## What it does

```
git diff (base..head, the index, or the working tree)
  -> change/       read the diff, find the tests, flag the static smells
  -> classifier/   ask one SystemOne call per test
  -> report/       print a verdict, a summary, and an exit code
```

Trust has two parts: `mass` and the spread between paraphrases. `mass` says
whether the endpoint answered at all. The spread says whether the judgement
survives rewording. A test escalates for one of two reasons. The endpoint was
unsure of a verdict-carrying answer, or the answers disagree with each other.
The tool never breaks a tie, because a silent pass is the failure it hunts.

## The questions

The tool asks 16 questions about one test. All questions share one state and
travel in one call.

| Question | Type | Looks for |
| --- | --- | --- |
| `can_fail_a` | yes/no | tautology, vacuous test, passes-with-zero |
| `can_fail_b` | yes/no, negated twin | the same judgement, asked the other way |
| `can_fail_c` | yes/no | the same judgement, asked directly |
| `asserts_a` | choice | behaviour, hardcoded data, shape only, interaction only, nothing |
| `asserts_b` | choice, order swapped | the position control for `asserts_a` |
| `type` | choice | unit, integration, regression, e2e, smoke, characterization |
| `observable` | yes/no | implementation coupling: private internals, call order, exact collaborator interactions |
| `conditional` | yes/no | conditional logic: a branch, loop, or catch can leave the assertion unrun |
| `isolated` | yes/no | interacting tests, test-run war, shared mutable state, order dependence |
| `controlled` | yes/no | resource optimism and mystery guest: an assumed network, clock, filesystem, or environment |
| `specific` | yes/no | a weak assertion, where the most specific assertion is possible |
| `named` | yes/no | an obscure test: a vague name that states no behaviour and no result |
| `deterministic` | yes/no | sleep, time, network, order dependence |
| `one_thing` | yes/no | eager test: several unrelated behaviours in one body |
| `name_matches` | yes/no | name-only test: the body asserts something other than the name |
| `verdict` | score | slop, weak, good, strong |

Three questions carry the verdict: the `can_fail_*` set, the `asserts_*` pair,
and `verdict`. The other questions add a flag. A flag does not escalate a test on
its own.

The three `can_fail_*` questions ask the same thing in different words. The tool
aligns their polarity and compares them. A spread above
`TEST_AUDIT_STABLE_BAND` means the judgement is unstable, so the test goes to a
human.

## What the endpoint sees

The state has three parts. The first part is the rubric. The rubric defines every
concept the questions use, so the endpoint knows what "falsifiable" and
"conditional logic" mean. The second part is the test: the file, the path, the
name, the source, the fixtures, and the imports. The third part is a capped slice
of the non-test diff.

Each question adds its own `instructions` and `criteria`. The `criteria` say what
each answer means. For example, `{"true": "a change can make it fail", "false":
"no change can make it fail"}`.

The reply holds `probabilities` and `confidence` for each answer. Some endpoints
also report `mass`.

## Static flags

Some defects need no model call. A skipped or focused test, an empty body, a test
with no assertion, and a commented-out assertion escalate at once. `roulette`
(several assertions and no message) is only a note.

The descriptive questions raise these flags: `implementation-coupled`,
`conditional`, `order-dependent`, `uncontrolled-resource`, `weak-assert`,
`vague-name`, `non-deterministic`, `eager`, and `name-mismatch`. These flags
report. They do not escalate.

## Endpoints and models

The client speaks the Jev SystemOne API, so it works with any compatible
endpoint.

- **Ollama 0.35 or later**, the default at `http://127.0.0.1:11434`. It serves
  local decision models such as `nimble` and `tev1`, and `clef` or `clef-flash`
  with vision. It rejects cloud models. It reports no `mass`.
- **[llama-arbiter](https://github.com/Vortiago/llama-arbiter)**, a decision
  endpoint for Jev-compatible models. It reports `mass` on each answer.
- **Ollaya** and other TypeSafe-compatible endpoints, at their own base URL.

Set one endpoint with `--url` and `--model`. Compare several on the corpus with
`--targets`. A target is `url|model`, or a bare `model` for the configured URL.

## Use

```sh
node test-audit/cli.mjs                     # the working tree against the default branch
node test-audit/cli.mjs --base main         # the change since the merge base of main
node test-audit/cli.mjs --staged            # the staged change
node test-audit/cli.mjs --files a.test.mjs  # named files
node test-audit/cli.mjs --json              # the full record
node test-audit/cli.mjs --markdown          # a review comment
node test-audit/cli.mjs --url http://127.0.0.1:11434 --model nimble   # one decision model
node test-audit/cli.mjs --selftest          # live calibration over corpus/
node test-audit/cli.mjs --selftest --targets "http://127.0.0.1:11434|nimble, http://127.0.0.1:11435|winnow:e4b"
node test-audit/cli.mjs --selftest --models "nimble,tev1"   # several models on one URL
node test-audit/cli.mjs --selftest --benchmark   # per-test results, in markdown
```

Exit code `0` means the tool classified every test and no test needs eyes. Exit
code `1` means a test is slop, weak, or unstable. Exit code `2` means a usage or
transport failure. A transport failure is an audit failure, not a skip.

## Config

| Variable | Default | Meaning |
| --- | --- | --- |
| `TEST_AUDIT_SYSTEMONE_URL` | `http://127.0.0.1:11434` | SystemOne base |
| `TEST_AUDIT_MODEL` | `nimble` | the decision model |
| `TEST_AUDIT_MIN_MASS` | `0.5` | trust floor, when the endpoint reports `mass` |
| `TEST_AUDIT_STABLE_BAND` | `0.25` | paraphrase spread ceiling |
| `TEST_AUDIT_CONCURRENCY` | `3` | calls in flight |
| `TEST_AUDIT_TIMEOUT_MS` | `120000` | timeout for one call |
| `TEST_AUDIT_STATE_CAP` | `8000` | characters in one test state |
| `TEST_AUDIT_CHANGE_CAP` | `3000` | characters of non-test diff context |

## Calibration

`--selftest` runs the labelled corpus against the configured endpoint and reports
agreement. The corpus covers each named defect, clean tests of the common types,
and mixed cases that should escalate.

The tool does not score a case that routed as unstable. The tool did not commit
to a value, so it escalated. Record each run in [`BENCHMARK.md`](BENCHMARK.md).
Run the selftest again when the model or a question changes.

## References

The table maps each question to the source that grounds it. The list is longer in
[`references.md`](references.md). That file also marks which claims are primary
sources and which are house inferences.

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

## Limits

- Agreement between paraphrases is necessary, not sufficient. A shared error in
  all phrasings still passes. The corpus and the escalation path carry that risk.
- `passes-for-the-wrong-reason` needs the mutation check to prove it. The audit
  can suspect it, through an interaction-only assertion or a remote fixture. It
  cannot prove it.
- When the endpoint reports no `mass`, the trust floor cannot apply. The
  paraphrase spread and the cross-question rule are then the only guard.
- The tool judges tests, not coverage. It never says that a change is tested
  enough. It says that each added test is a real guard.
- The extractor reads `test` and `it` calls with a literal or a computed name. It
  folds a `test.each` table into one test and flags a computed name. The
  extractor does not match the tagged-template form or the generic form
  (`test.each<T>`).
- The core modules are `.mjs`, so the `tsc` gate does not check them. They import
  `node:*`, and the gate carries no `@types/node`. The `node --test` suite guards
  them instead.

An OpenCode plugin wraps this tool: [`../opencode-test-audit`](../opencode-test-audit).
