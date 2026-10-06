# test-audit

test-audit checks each test that a change adds. It asks a SystemOne endpoint the
questions a reviewer asks about the test, and it prints one verdict per test. If
a test needs a closer look, the tool escalates it to a human.

The tool is a cheap sensor. It separates a real guard from fake safety. It does
not prove that a change is tested. For that proof, use
[`verify-prd-implemented`](../verify-prd-implemented/SKILL.md). That skill breaks
the behaviour of the code and checks that the named test fails.

The [`opencode-test-audit`](../opencode-test-audit/README.md) plugin runs this
tool inside OpenCode.

## Run an audit

```sh
node test-audit/cli.mjs                     # the working tree against the merge base of the default branch
node test-audit/cli.mjs --base main         # the working tree against the merge base of main
node test-audit/cli.mjs --head feature      # the range <default branch>...feature
node test-audit/cli.mjs --staged            # the staged change
node test-audit/cli.mjs --files a.test.mjs  # named files
node test-audit/cli.mjs --json              # the full record, as JSON
node test-audit/cli.mjs --markdown          # a review comment, in markdown
node test-audit/cli.mjs --url http://127.0.0.1:11434 --model nimble   # one endpoint and decision model
node test-audit/cli.mjs --help              # all options
```

The working tree includes untracked files. The default branch is `origin/HEAD`.
If `origin/HEAD` is not set, the tool uses `origin/main`, then `main`.

In a test file that the change modifies, the tool audits only the tests whose
lines the change adds or edits. A new, untracked, or named file counts whole.

The exit code tells a script the result:

| Exit code | Meaning |
| --- | --- |
| `0` | The tool classified every test, and no test needs eyes. |
| `1` | At least one test needs eyes. A slop or weak verdict always needs eyes. |
| `2` | A usage failure or a transport failure. |

A transport failure is an audit failure, not a skip.

## Read the report

The text report has three parts:

1. A table with one row per test: `VERDICT`, `EYES`, `TYPE`, `CAN-FAIL`,
   `ASSERTS`, `LOCATION` and `NAME`. A `flags:` line under a row lists the flags
   of that test.
2. A `Needs eyes:` list. It gives each escalated test and the reasons it
   escalates.
3. A summary line: the count of each verdict, the count of unstable tests, and
   the calls and tokens used.

The verdict is the answer to the `verdict` question: slop, weak, good or strong.
It is `unclassified` when the endpoint gave no trusted answer.
`CAN-FAIL` is the mean probability that the test can fail, over the three
`can_fail_*` phrasings. A `!` after the value means the spread between the phrasings is above the band.

### When a test needs eyes

A test escalates, and needs eyes, for each of these reasons:

- The endpoint gave no answer, or a verdict-carrying answer is missing or
  untrusted.
- The paraphrases disagree. The `can_fail_*` spread is above
  `TEST_AUDIT_STABLE_BAND`, or `asserts_a` and `asserts_b` differ.
- The test does not run.
- The test has no positive assertion.
- The test asserts something other than behaviour: hardcoded data, shape only,
  interaction only, or nothing.
- The verdict is slop or weak.
- A confident "cannot fail" sits beside a good or strong verdict.
- A test file that the change touches holds no test the extractor can read. The
  report shows it as `(no test found)`, so a form the extractor misses is never
  a clean pass.

The tool never breaks a tie between answers that disagree. A silent pass is the
failure it hunts, so it escalates instead.

### Flags

A flag describes a test. It does not escalate the test on its own. The
descriptive questions raise these flags: `implementation-coupled`,
`conditional`, `order-dependent`, `uncontrolled-resource`, `weak-assert`,
`vague-name`, `non-deterministic`, `eager`, `name-mismatch`,
`structure-dependent`, `silent-failure`, `general-fixture`, `slow`, `obscure`,
`magic-number`, `asserts-input`, `manual`, and `state-leak`. An `asserts` answer
other than `behaviour` is also a flag, for example `shape-only`. The extractor
adds its own notes: `each` for a table test, `dynamic-name` for a computed name,
and `focus-in-file` when an only or focus marker in the file narrows the run.

## Choose an endpoint

The tool speaks the Jev SystemOne API, so it works with any compatible endpoint.

- **Ollama 0.35 or later** is the default, at `http://127.0.0.1:11434`. It serves
  local decision models such as `nimble` and `tev1`, and `clef` or `clef-flash`
  with vision. It rejects cloud models. It reports no `mass`.
- **[llama-arbiter](https://github.com/Vortiago/llama-arbiter)** is a decision
  endpoint for Jev-compatible models. It reports `mass` on each answer.
- **Ollaya** and other TypeSafe-compatible endpoints work at their own base URL.

Set one endpoint with `--url` and `--model`, or with the environment variables
below. To compare several endpoints, see [Calibrate](#calibrate).

| Variable | Default | Meaning |
| --- | --- | --- |
| `TEST_AUDIT_SYSTEMONE_URL` | `http://127.0.0.1:11434` | SystemOne base URL |
| `TEST_AUDIT_MODEL` | `nimble` | the decision model |
| `TEST_AUDIT_MIN_MASS` | `0.5` | trust floor, when the endpoint reports `mass` |
| `TEST_AUDIT_STABLE_BAND` | `0.25` | paraphrase spread ceiling |
| `TEST_AUDIT_CONCURRENCY` | `3` | calls in flight |
| `TEST_AUDIT_TIMEOUT_MS` | `120000` | timeout for one call |
| `TEST_AUDIT_STATE_CAP` | `8000` | characters in one test state |
| `TEST_AUDIT_CHANGE_CAP` | `3000` | characters of non-test diff context |

## How the tool judges a test

```
git diff (base..head, the index, or the working tree)
  -> change/       read the diff and find the tests
  -> classifier/   ask one SystemOne call per test
  -> report/       print a verdict, a summary, and an exit code
```

The tool does no static analysis of the test source. Each test framework has its
own syntax, for example for an assertion or a skip, and each would need its own
rule. The questions read the source and judge the intent instead, so one battery
works for all runners. The tool reads the syntax only to find the test blocks.

### What the endpoint sees

The state has three parts:

1. The rubric. It defines every concept the questions use, so the endpoint knows
   what "falsifiable" and "conditional logic" mean.
2. The test: the file, the path, the name, the source, the fixtures, and the
   imports. When there are any, also the heads of the enclosing `describe`
   calls and the extractor's notes (`each`, `dynamic-name`, `focus-in-file`), so
   that `runs` can see a `describe.skip` or a focus marker in a sibling test.
3. A capped slice of the non-test diff.

Each question adds its own `instructions` and `criteria`. The `criteria` say what
each answer means, for example `{"true": "a change can make it fail", "false":
"no change can make it fail"}`.

The reply holds `probabilities` and `confidence` for each answer. Some endpoints
also report `mass`.

### The battery

The battery is 27 questions about one test. All questions share one state and
travel in one call.

| Question | Type | Looks for |
| --- | --- | --- |
| `can_fail_a` | yes/no | tautology, vacuous test, passes-with-zero |
| `can_fail_b` | yes/no, negated twin | the same judgement, asked the other way |
| `can_fail_c` | yes/no | the same judgement, asked directly |
| `asserts_a` | choice | behaviour, hardcoded data, shape only, interaction only, nothing |
| `asserts_b` | choice, order swapped | the position control for `asserts_a` |
| `positive` | yes/no | only-negative test: no assertion on the output that must exist |
| `runs` | yes/no | a skipped, ignored, or focused test that does not run |
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
| `resilient` | yes/no | structure sensitivity: a behaviour-preserving refactor breaks the test |
| `diagnostic` | yes/no | assertion roulette: a failure does not say which assertion failed |
| `fixture` | yes/no | general fixture and irrelevant information: data the test does not need |
| `fast` | yes/no | slow test: a sleep, heavy I/O, or a large computation |
| `readable` | yes/no | obscure test: a reader must open the code under test to follow it |
| `magic_number` | yes/no | magic number test: a bare value the reader must decode |
| `reads_output` | yes/no | assertion diversion: the assertion reads its own input or its setup, or only that no error was thrown |
| `automated` | yes/no | manual intervention: a step a person must do, or output a person must read |
| `restores` | yes/no | test pollution: state left behind for the next test |
| `verdict` | score | slop, weak, good, strong |

Five answers carry the verdict: `positive`, `runs`, the `can_fail_*` set, the
`asserts_*` pair, and `verdict`. The other 18 questions are the descriptive
questions. Each one raises a flag.

### Trust

The tool trusts an answer in two ways:

- `mass` says whether the endpoint answered at all. An answer with a `mass`
  below `TEST_AUDIT_MIN_MASS` is untrusted.
- The spread says whether the judgement survives rewording. The three
  `can_fail_*` questions ask the same thing in different words. The tool aligns
  their polarity and compares them. A spread above `TEST_AUDIT_STABLE_BAND`
  means the judgement is unstable.

## Calibrate

```sh
node test-audit/cli.mjs --selftest          # live calibration over the labelled corpus
node test-audit/cli.mjs --selftest --targets "http://127.0.0.1:11434|nimble, http://127.0.0.1:11435|winnow:e4b"
node test-audit/cli.mjs --selftest --models "nimble,tev1"   # several models on one URL
node test-audit/cli.mjs --selftest --benchmark   # a per-case report, in markdown
```

`--selftest` runs the labelled corpus in `calibration/` against the configured
endpoint and reports agreement with the labels. The corpus covers each named
defect, clean tests of the common types, and mixed cases that should escalate. A
target in `--targets` is `url|model`, or a bare `model` for the configured URL.

A run passes acceptance when all of these are true:

- No defect case passes silently.
- Every mixed case escalates.
- Every labelled case resolves to a test in its case file, and the endpoint
  answers it. A transport failure is not a routed case.
- The `can_fail` agreement is 90% or more (set in `calibration/labels.json`).

The selftest exits `0` when every target passes acceptance, and `1` when one
fails. The tool does not score the `can_fail` answer of a case that escalated as
unstable, because the tool did not commit to a value.

`--benchmark` prints the run as a markdown report. The report starts with a
summary: the headline numbers, one row for each defect family, and links to the
cases that are not OK. A legend explains the terms once. Then each case has its
own section:

1. The test source, as the extractor found it in the case file.
2. The label in plain words: the known defect and the expected outcome.
3. A table of the questions. Each row gives the answer, its probability, and its
   effect: a match with the label, a flag, or an escalation reason. The
   verdict-carrying questions come first.
4. The outcome: the verdict, the escalation reasons, and the status against the
   label.

Run the selftest again when the model or a question changes. Record each run in
[`BENCHMARK.md`](BENCHMARK.md), with the command above the report. The recorded
run there passes acceptance. The code has changed since that run, so its numbers
are a baseline to run again.

## Limits

- Agreement between paraphrases is necessary, not sufficient. A shared error in
  all phrasings still passes. The corpus and the escalation path carry that risk.
- Only the mutation check can prove `passes-for-the-wrong-reason`. The tool can
  suspect it, from an interaction-only assertion or a remote fixture. It cannot
  prove it.
- When the endpoint reports no `mass`, the trust floor cannot apply. The
  paraphrase spread and the cross-question rule are then the only guard.
- The tool judges tests, not coverage. It never says that a change is tested
  enough. It says whether each added test is a real guard.
- The extractor reads `test` and `it` calls with a literal or a computed name,
  with a member chain such as `test.skip.each` or `test.skipIf(cond)`, and
  node:test's `suite`, `before` and `after` beside `describe` and its hooks. It
  folds a `test.each` table into one test and flags a computed name. The
  extractor does not match the tagged-template form, the generic form
  (`test.each<T>`), or a test called on a runner object (`t.test(...)`). In JSX,
  an apostrophe in element text (`<p>Don't</p>`) can still hide the test that
  holds it.

## References

The table maps each question to the source that grounds it.
[`references.md`](references.md) has the full list. It also marks which claims
are primary sources and which are house inferences.

| Looking for | Grounded in |
| --- | --- |
| Falsifiability (`can_fail_*`) | Beck, *Test Desiderata* (`Behavioral`); WPT review checklist, "fails when it's supposed to fail"; Meszaros, `Erratic Test`; the mutation-testing literature |
| Assertion target (`asserts_*`) | testsmells.org, Open Catalog of Test Smells (`Redundant Assertion`, `Unknown Test`, `Sensitive Equality`, `Magic Number Test`); Meszaros, `Obscure Test`; Fowler, "Mocks Aren't Stubs" |
| Runs (`runs`) | testsmells.org, `Ignored Test`; Meszaros, `Ignored Test`; the house catalogue, skipped / disabled / focused |
| Only negative (`positive`) | the house catalogue, no negative/positive pair; the WPT checklist, "fails when it's supposed to fail" |
| Implementation coupling (`observable`) | Meszaros, `Indirect Testing`; Fowler, "Mocks Aren't Stubs"; testsmells.org, `Redundant Assertion` |
| Conditional logic (`conditional`) | Meszaros, `Conditional Test Logic`; testsmells.org, `Conditional Test Logic` |
| Isolation (`isolated`) | Beck, `Isolated`; Meszaros, `Interacting Tests`, `Test Run War`, `Unrepeatable Test` |
| Controlled resources (`controlled`) | Meszaros, `Resource Optimism`, `Mystery Guest`; testsmells.org, `Mystery Guest` |
| Specific assertion (`specific`) | WPT checklist, "the most specific asserts possible"; testsmells.org, `Sensitive Equality` |
| Vague name (`named`) | Meszaros, `Obscure Test`; testsmells.org, `Unknown Test` |
| Structure-insensitive (`resilient`) | Beck, `Structure-insensitive`; Meszaros, `Fragile Test` and `Sensitive Equality` |
| Diagnostic failure (`diagnostic`) | Meszaros, `Assertion Roulette` (`Missing Assertion Message`); testsmells.org, `Assertion Roulette` |
| Fixture scope (`fixture`) | Meszaros, `General Fixture` and `Irrelevant Information` |
| Speed (`fast`) | Beck, `Fast`; Meszaros, `Slow Tests` and `Sleepy Test`; testsmells.org, `Sleepy Test` |
| Readability (`readable`) | Beck, `Readable`; Meszaros, `Obscure Test`; testsmells.org, `Unknown Test` |
| Magic number (`magic_number`) | testsmells.org, `Magic Number Test`; Meszaros, `Hard-Coded Test Data` |
| Asserts the output (`reads_output`) | testsmells.org, `Assertion Diversion`, `Calculating Expected Results On The Fly`; the house catalogue, passes-for-the-wrong-reason; mutation-testing propagation |
| Automated (`automated`) | Beck, `Automated`; Meszaros, `Manual Intervention`; the WPT checklist on manual tests |
| Restores state (`restores`) | Beck, `Isolated`; Meszaros, `Interacting Tests`, `Test Run War`; testsmells.org, `Test Pollution` |
| Test type (`type`) | Meszaros, `Test Organization`; Feathers, characterization testing. The six labels are house choice |
| Determinism (`deterministic`) | Beck, `Deterministic` and `Isolated`; Meszaros, `Erratic Test`; testsmells.org, `Sleepy Test` and `Mystery Guest` |
| Eager test (`one_thing`) | Meszaros, `Eager Test`; testsmells.org, `Eager Test` |
| Name matches body (`name_matches`) | WPT checklist, "testing what it thinks it's testing"; testsmells.org, `Unknown Test`; the house catalogue |
| Cross-question contradiction (`verdict`) | a house rule, inferred from the sources |
| Escalate, never tie-break | Böckeler, "Maintainability sensors for coding agents" |
| Paraphrase pair and position swap | self-consistency (Wang et al. 2023); MT-Bench and "not Fair Evaluators" on position bias |
| The house defect catalogue | [`verify-prd-implemented/test-patterns.md`](../verify-prd-implemented/test-patterns.md) |
