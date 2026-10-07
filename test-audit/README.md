# test-audit

test-audit checks each test that a change adds. It asks a SystemOne endpoint the
questions a reviewer asks about the test, and it prints one verdict per test. If
a test needs a closer look, the tool escalates it to a human.

The tool is a cheap sensor. It separates a real guard from fake safety. It does
not prove that a change is tested. For that proof, use
[`verify-prd-implemented`](../verify-prd-implemented/SKILL.md). That skill breaks
the behaviour of the code and checks that the named test fails.

The [OpenCode plugin](#opencode-plugin) in
[`../opencode-test-audit`](../opencode-test-audit/README.md) runs this tool
inside OpenCode.

## Layout

The tool has one folder per check. A check is one judgement the tool asks the
model about a test: one question, or a set of phrasings of one judgement. The
folder holds all of the check: its questions, its role in the verdict, its
sources, and the calibration cases meant to catch its defect.

```
test-audit/
  checks/                 one folder per check
    index.mjs             puts the checks together into the battery
    checks.test.mjs       keeps the folders, the battery, and the cases in step
    battery.snapshot.json the questions the model sees, byte for byte
    runs/
      check.mjs           the questions and the role; its header names the sources
      cases/
        skip-token/
          case.mjs        the test; its header names the defect and the sources, and the model never sees it
          label.json      the known defect and the expected outcome
          code.mjs        the code under test, if the right answer depends on it
    can-fail/  asserts/  positive/  verdict/  and 5 descriptive checks
  change/                 read the diff and find the tests
  classifier/             ask one SystemOne call per test, and apply the verdict rules
  report/                 print one finding per test, a summary, and an exit code
  calibration/            run the cases against an endpoint, and judge the run
```

To change what the tool asks about a test, edit the `check.mjs` of that check.
To add a case, add a folder to its `cases/`. A case file is `case.mjs`, not
`test.mjs`, because a bare `node --test` runs every `test.mjs` it finds, and the
cases are deliberately bad tests.

## Run an audit

```sh
node test-audit/cli.mjs                     # the working tree against the merge base of the default branch
node test-audit/cli.mjs --base main         # the working tree against the merge base of main
node test-audit/cli.mjs --head feature      # the range <default branch>...feature
node test-audit/cli.mjs --staged            # the staged change
node test-audit/cli.mjs --files a.test.mjs  # named files
node test-audit/cli.mjs --table             # a table of every test, not one line per finding
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

The report is for an LLM that decides what to do with each test. It gives one
line for each test that needs an action, the worst first, and a summary line:

```
drop  src/a.test.mjs:12  "the build is green"  cannot fail; slop guard  (sure)
fix   src/b.test.mjs:40  "loads the profile"  asserts only the shape  (sure)
look  src/c.test.mjs:7  "the retry lands"  can_fail unstable (spread 0.48)  (unsure, possibly a false positive)
4 tests: 1 drop, 1 fix, 1 look, 1 ok. 4 calls, 21000 tokens.
```

| Action | Meaning |
| --- | --- |
| `drop` | The test cannot guard anything: it cannot fail, it asserts nothing, or its expected value comes from the code under test. |
| `fix` | The test runs a weak check (only a shape, a mock call, or its input; no positive assertion; a weak verdict), it does not run, or it is flaky, order-dependent, leaks state, holds conditional logic, or needs a person. |
| `look` | The tool is not sure: the phrasings disagree, an answer is missing, or answers contradict each other. The finding may be a false positive. |
| `ok` | Nothing to report. The test gets no line. |

`sure` means the answers behind the finding agree and sit well away from 0.5 or
from a verdict boundary. `unsure, possibly a false positive` means they do not,
so the reader should check the test before it acts. `classifier/finding.mjs`
holds the rules.

`--table` prints a table of every test instead: the verdict, whether it needs
eyes, the `can_fail` mean, the assert kind, and the flags. The verdict is slop,
weak, or good, computed from whether the test can fail and what it asserts.
`CAN-FAIL` is the mean over the two `can_fail_*` phrasings; a `!` after it
means their spread is above the band.

### When a test needs eyes

A test escalates, and needs eyes, for each of these reasons:

- The endpoint gave no answer, or a verdict-carrying answer is missing or
  untrusted.
- The paraphrases disagree. The spread of the `can_fail_*` set, the `runs_*`
  pair, or the `positive_*` pair is above `TEST_AUDIT_STABLE_BAND`, or
  `asserts_a` and `asserts_b` differ.
- The test does not run, or an only or focus marker in its file leaves other
  tests out of the run.
- The test has no positive assertion.
- The strongest assertion checks something other than behaviour: hardcoded
  data, its own input, shape only, interaction only, or nothing.
- "Cannot fail" sits beside an assertion that checks the behaviour.
- A yes/no judgement lands exactly on 0.5.
- A test file that the change touches holds no test the extractor can read. The
  report shows it as `(no test found)`, so a form the extractor misses is never
  a clean pass.

The tool never breaks a tie between answers that disagree. A silent pass is the
failure it hunts, so it escalates instead.

### Flags

A flag describes a test. It does not escalate the test on its own, but the
brief report turns a flag that makes a test unreliable into a `fix`. The
descriptive questions raise these flags: `conditional`, `order-dependent`,
`non-deterministic`, `manual`, and `state-leak`. An `asserts` kind
other than `behaviour` is also a flag, for example `shape-only`, when both
phrasings give it. The extractor adds its own notes: `each` for a table test,
`dynamic-name` for a computed name, and `focus-in-file` when an only or focus
marker in the file narrows the run.

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
| `TEST_AUDIT_STATE_CAP` | `5000` | characters in one test state |
| `TEST_AUDIT_CHANGE_CAP` | `3000` | characters of non-test diff context |

## OpenCode plugin

[`opencode-test-audit`](../opencode-test-audit/README.md) is an
[OpenCode](https://opencode.ai) 2 plugin that runs this tool. OpenCode installs
only the `path:` directory of a plugin, so the plugin carries a stamped copy of
the modules the audit loads in `opencode-test-audit/core/`. This directory is
the canon. After you change a module here, re-vendor it:

```sh
opencode-test-audit/sync-from-test-audit.sh
```

CI runs `sync-from-test-audit.sh --check` and fails on a stale copy.

## How the tool judges a test

```
git diff (base..head, the index, or the working tree)
  -> change/       read the diff and find the tests
  -> classifier/   ask the questions of checks/ in one SystemOne call per test
  -> report/       print a verdict, a summary, and an exit code
```

The tool does no static analysis of the test source. Each test framework has its
own syntax, for example for an assertion or a skip, and each would need its own
rule. The questions read the source and judge the intent instead, so one battery
works for all runners. The tool reads the syntax only to find the test blocks.

### What the endpoint sees

SystemOne is an API for decision models: each question is judged alone against
one state, in one pass, and the answer is a probability, not text. So the
battery follows the documented style: one specific judgement per question, one
line, asked the plain way round, with one-line criteria that separate the
answers. Code composes the answers into a verdict and a finding.

The state is the test and nothing else:

1. The test record: the file, the path, the name, the source, the fixtures, and
   the imports. When there are any, also the heads of the enclosing `describe`
   calls and the extractor's notes (`each`, `dynamic-name`, `focus-in-file`), so
   that `runs` can see a `describe.skip` or a focus marker in a sibling test.
2. A capped slice of the non-test diff.

There is no shared rubric: text unrelated to a decision lowers its accuracy, so
each question carries its own definition in its criteria, for example
`{"true": "yes: a regression fails it", "false": "no: a regression leaves it
passing"}`.

The reply holds `probabilities` and `confidence` for each answer. Some endpoints
also report `mass`. Each endpoint computes `confidence` its own way, so the tool
reads the probabilities and `mass` instead.

### The battery

The battery is 13 questions about one test, from 10 checks. All questions share
one state and travel in one call. Each check is a folder in `checks/`, and
`checks/index.mjs` sets the order. The role of a check tells the verdict rules
in `classifier/verdict.mjs` what to do with its answers. So a new check needs
only its folder and one line in `checks/index.mjs`.

| Check | Questions | Role | Looks for | Cases |
| --- | --- | --- | --- | --- |
| [`can-fail`](checks/can-fail/check.mjs) | `can_fail_a`, `can_fail_c` | can-fail | tautology, self-reference, vacuous test, passes-with-zero | 9 |
| [`asserts`](checks/asserts/check.mjs) | `asserts_a`, `asserts_b` (order swapped) | asserts | hardcoded data, input only, shape only, interaction only, nothing, or unclear; judged by the strongest assertion | 14 |
| [`positive`](checks/positive/check.mjs) | `positive_a`, `positive_b` | gate: no positive assertion | only-negative test | 7 |
| [`runs`](checks/runs/check.mjs) | `runs_a`, `runs_b` | gate: does not run, or narrows the run | a skip or todo marker on the test or on a describe around it, or an only or focus marker anywhere in the file | 6 |
| [`conditional`](checks/conditional/check.mjs) | `conditional` | flag `conditional` | a branch, a loop over a value that may be empty, an early return, or a catch that can leave an assertion unrun | 3 |
| [`isolated`](checks/isolated/check.mjs) | `isolated` | flag `order-dependent` | a value another test sets, or a shared object no hook resets | 2 |
| [`deterministic`](checks/deterministic/check.mjs) | `deterministic` | flag `non-deterministic` | a sleep, the real clock, the network, real randomness, an unguaranteed order | 8 |
| [`automated`](checks/automated/check.mjs) | `automated` | flag `manual` | a print-only test, or a step a person must do | 2 |
| [`restores`](checks/restores/check.mjs) | `restores` | flag `state-leak` | a global, environment variable, timer, mock, or shared object left changed | 3 |
| [`verdict`](checks/verdict/check.mjs) | none: computed | verdict | slop, weak, or good, from the answers above; its cases are the clean and the mixed tests, and the cases of the smells the battery no longer asks | 50 |

Four checks carry the verdict: `can_fail`, `asserts`, `positive`, and `runs`.
Each asks its judgement twice, in two plain phrasings: a decision model answers
a negation less reliably, so no phrasing is negated. A pair whose phrasings
disagree beyond the band escalates, so one confident wrong answer cannot pass a
test alone. The `asserts` pair also lists its kinds in reverse order, as a
position control, and an `unclear` answer escalates. The other 5 questions are
the descriptive questions. Each one raises a flag.

The verdict is not asked. Code computes it: slop when the test cannot fail,
asserts nothing, or takes its expected value from the code under test; weak
when it checks only a shape, a mock call, or its input, or has no positive
assertion; good otherwise. "Cannot fail" beside a behaviour assertion is a
contradiction, and escalates.

### Trust

The tool trusts an answer in two ways:

- `mass` says whether the endpoint answered at all. An answer with a `mass`
  below `TEST_AUDIT_MIN_MASS` is untrusted.
- The spread says whether the judgement survives rewording. Each
  verdict-carrying check asks its judgement in two phrasings, and the tool
  compares them. A spread above `TEST_AUDIT_STABLE_BAND` means the judgement is
  unstable.

## Calibrate

```sh
node test-audit/cli.mjs --selftest          # live calibration over the labelled corpus
node test-audit/cli.mjs --selftest --targets "http://127.0.0.1:11434|nimble, http://127.0.0.1:11435|winnow:e4b"
node test-audit/cli.mjs --selftest --models "nimble,tev1"   # several models on one URL
node test-audit/cli.mjs --selftest --cases "result-keys,adds two numbers"   # only these cases, by folder or test name
node test-audit/cli.mjs --selftest --benchmark   # a per-case report, in markdown
```

`--selftest` runs the labelled cases in `checks/*/cases/` against the configured
endpoint and reports agreement with the labels. The machinery is in
`calibration/`. The cases cover each named defect, clean tests of the common
types, and mixed cases that should escalate. A target in `--targets` is
`url|model`, or a bare `model` for the configured URL.

A case sends the model what a real audit sends: the test, and, when the case
folder holds a `code.mjs`, the code under test as the change context, through
the same cap. `calibration/case-state.mjs` builds this once for each case. Give a
case its `code.mjs` when the right answer depends on the code. For example, a
test that asserts `taxRates()` equals `TAX_RATES` agrees by construction only if
`taxRates()` returns that same constant. The model sees neutral paths
(`example.test.mjs`, `src/example.mjs`), because the path of a case states its
label. The model sees only the test call, so the header comment of `case.mjs`
can name the defect and its source.

A `label.json` holds the test name, the known `defect`, the expected `canFail`,
`mustEscalate` and `mixed`, and a `note`. It can also name a check and the value
that check must give, such as `"named": false` or `"asserts": "behaviour"`. Give
each check at least one case where its good answer is right and one where its
bad answer is right, so a question that the model misreads shows on both sides.
A descriptive check only raises a flag, so a misread one never shows in
escalation; its label value is the only thing that measures it.

A run passes acceptance when all of these are true:

- No defect case passes silently.
- Every mixed case escalates.
- Every labelled case resolves to a test in its case file, and the endpoint
  answers it. A transport failure is not a routed case.
- The `can_fail` agreement is 90% or more (set in `calibration/judge.mjs`).

The selftest exits `0` when every target passes acceptance, and `1` when one
fails. The tool does not score the `can_fail` answer of a case that escalated as
unstable, because the tool did not commit to a value. The same holds for a check
value that a label names. The check agreement is reported, for each check, but
it is not an acceptance rule. A case whose check value differs from its label
shows as **WRONG check**.

`--benchmark` prints the run as a markdown report, in this order:

1. A summary: the headline numbers, one row for each defect family, the check
   agreement for each check that a label names, and links to the cases that are
   not OK.
2. Cases at a glance: one table row for each case, with the test, its check,
   the known defect, the expected outcome, the result and the status. The cases that are
   not OK come first.
3. One collapsible block for each case. It holds the test source, the code under
   test if the label names one, and the label in plain words. A short list ties
   each escalation reason to the answers behind it, one answer for each
   phrasing. One line sums up the descriptive questions. A case that is not OK
   is open.
4. A legend, and the questions with their words from the battery.

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

Each check names its sources in the header comment of its
`checks/<check>/check.mjs`. [`references.md`](references.md) is the index to
all the sources, and it lists the background reading.
