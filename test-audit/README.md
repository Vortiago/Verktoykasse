# test-audit

test-audit checks each test a change adds. It asks a SystemOne endpoint the
questions a reviewer asks about the test, and prints one verdict per test. A
test that needs a closer look escalates to a human.

The tool is a cheap sensor: it separates a real guard from fake safety. It does
not prove that a change is tested. For that proof, use
[`verify-prd-implemented`](../verify-prd-implemented/SKILL.md): it breaks the
behaviour and checks that the named test fails.

The [OpenCode plugin](#opencode-plugin) in
[`../opencode-test-audit`](../opencode-test-audit/README.md) runs this tool
inside OpenCode.

## Layout

One folder per check. A check is one judgement about the test: asked as one
question, a phrasing pair, or a set of fact questions, or read from the code.
The folder holds all of it: the questions, its role in the verdict, its sources,
and the calibration cases meant to catch its defect.

```
test-audit/
  checks/                 one folder per check
    index.mjs             puts the checks together into the battery
    checks.test.mjs       keeps the folders, the battery, and the cases in step
    battery.snapshot.json the questions the model sees, byte for byte
    runs/
      check.mjs           its role, and its questions if it asks any; its header names the sources
      cases/
        skip-token/
          case.mjs        the test; its header names the defect and the sources, and the model never sees it
          label.json      the known defect and the expected outcome
          code.mjs        the code under test, if the right answer depends on it
    can-fail/  asserts/  positive/  runs/  verdict/  and 6 descriptive checks
  change/                 read the diff and find the tests
  classifier/             ask one SystemOne call per test, and apply the verdict rules
  report/                 print one finding per test, a summary, and an exit code
  calibration/            run the cases against an endpoint, and judge the run
```

Edit the `check.mjs` of a check to change what the tool asks. Add a folder to
its `cases/` to add a case. A case file is `case.mjs`, not `test.mjs`: a bare
`node --test` runs every `test.mjs` it finds, and the cases are deliberately
bad tests.

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

The default branch is `origin/HEAD`; then `origin/main`, then `main`. The
working tree includes untracked files. In a test file the change modifies, the
tool audits only the tests whose lines the change adds or edits; a new,
untracked, or named file counts whole. Python test files are read too; see
[Limits](#limits).

The exit code:

| Exit code | Meaning |
| --- | --- |
| `0` | Every test classified, no test needs eyes. |
| `1` | At least one test needs eyes. A slop or weak verdict always needs eyes. |
| `2` | A usage failure or a transport failure. |

A transport failure is an audit failure, not a skip.

## Read the report

The report is for an LLM that decides what to do with each test. One line per
test that needs an action, worst first, then a summary line:

```
drop  src/a.test.mjs:12  "the build is green"  cannot fail  (sure)
fix  src/b.test.mjs:40  "loads the profile"  asserts only the shape  (sure)
look  src/c.test.mjs:7  "the retry lands"  can_fail unstable (spread 0.48)  (unsure, possibly a false positive)
4 tests: 1 drop, 1 fix, 1 look, 1 ok. 4 calls, 21000 tokens.
```

| Action | Meaning |
| --- | --- |
| `drop` | The test cannot guard anything: it cannot fail, or its expected value and its result come from the same code, so they always agree. |
| `fix` | A weak check: no positive assertion, or only a shape, a mock call, or its input; a weak verdict; it does not run; it is flaky, order-dependent, leaks state, holds conditional logic, reaches into internals; or it needs a person. |
| `look` | The tool is not sure: the phrasings disagree, an answer is missing, or answers contradict each other. The finding may be a false positive. |
| `ok` | Nothing to report. The test gets no line. |

A line ends with `sure`, with `unsure, possibly a false positive`, or with
`not judged` when the endpoint gave no answer at all. `sure`
means the answers behind the finding agree and sit away from 0.5 and from a
verdict boundary. Otherwise the reader should check the test before acting.
`classifier/finding.mjs` holds the rules.

`--table` prints one row per test instead: the verdict (slop, weak, good, or
unclassified), whether it needs eyes, the `can_fail` mean (`!` after it: the
pair's spread is above the band), the assert kind, the location, and the name.
A row with flags adds an indented `flags:` line under it.

### When a test needs eyes

A test escalates for each of these reasons:

- The endpoint gave no answer, or a verdict-carrying answer is missing or
  untrusted.
- The paraphrases disagree: the spread of the `can_fail_*` or `positive_*` pair
  is above `TEST_AUDIT_STABLE_BAND`, or the `asserts_*` answers contradict each
  other, such as "compares content" beside "only the shape".
- The test does not run, or an only or focus marker in its file leaves other
  tests out of the run.
- The test has no positive assertion.
- The strongest assertion checks something other than behaviour: hardcoded
  data, its own input, shape only, interaction only, or nothing.
- "Cannot fail" sits beside an assertion that checks the behaviour.
- A yes/no judgement lands exactly on 0.5.
- A file the change touches that is named as a test (`--files`, `*.test.*`,
  `*.spec.*`, or `test_*.py`) holds no test the extractor can read. The report
  shows it as `(no test found)`, so a form the extractor misses is never a
  clean pass.

The tool never breaks a tie between answers that disagree. A silent pass is the
failure it hunts, so it escalates instead.

### Flags

A flag describes a test and never escalates on its own, but the brief report
turns a flag that makes a test unreliable into a `fix`. The descriptive
questions raise `conditional`, `order-dependent`, `non-deterministic`,
`manual`, `state-leak`, and `structure-dependent`. The `asserts` kind is also a
flag when it is not `behaviour`, for example `shape-only`. The extractor adds
its own notes: `each` for a table test, `dynamic-name`
for a computed name, and `focus-in-file` when an only or focus marker in the
file narrows the run.

## Choose an endpoint

The tool speaks the Jev SystemOne API, so any compatible endpoint works.

- **Ollama 0.35 or later** is the default, at `http://127.0.0.1:11434`. It
  serves local decision models such as `nimble` and `tev1`, and `clef` or
  `clef-flash` with vision. It rejects cloud models. It reports no `mass`.
- **[llama-arbiter](https://github.com/Vortiago/llama-arbiter)** is a decision
  endpoint for Jev-compatible models. It reports `mass` on each answer.
- **Ollaya** and other TypeSafe-compatible endpoints work at their own base URL.

Set one endpoint with `--url` and `--model`, or with the variables below. To
compare several endpoints, see [Calibrate](#calibrate).

| Variable | Default | Meaning |
| --- | --- | --- |
| `TEST_AUDIT_SYSTEMONE_URL` | `http://127.0.0.1:11434` | SystemOne base URL |
| `TEST_AUDIT_MODEL` | `nimble` | the decision model |
| `TEST_AUDIT_MIN_MASS` | `0.5` | trust floor, when the endpoint reports `mass` |
| `TEST_AUDIT_STABLE_BAND` | `0.25` | paraphrase spread ceiling |
| `TEST_AUDIT_CONCURRENCY` | `3` | calls in flight |
| `TEST_AUDIT_TIMEOUT_MS` | `120000` | timeout for one call |
| `TEST_AUDIT_STATE_CAP` | `24000` | characters in one test state: about 6000 tokens, so it fits an 8192-token decision-model prompt. Set it lower for a smaller window |
| `TEST_AUDIT_CHANGE_CAP` | `3000` | characters of non-test diff context |
| `TEST_AUDIT_RAW_LOG` | unset | with `--selftest`, a file to append each reply to, as one JSON line |

## OpenCode plugin

[`opencode-test-audit`](../opencode-test-audit/README.md) is an
[OpenCode](https://opencode.ai) 2 plugin that runs this tool. OpenCode installs
only the `path:` directory of a plugin, so the plugin carries a stamped copy of
the modules in `opencode-test-audit/core/`. This folder, `test-audit/`, is the
canon. After you change a module here, re-vendor it:

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

The tool does no static analysis of the test source. Each framework has its own
syntax for an assertion or a skip, and each would need its own rule. The
questions read the source and judge the intent instead, so one battery works
for all runners. The tool reads the syntax only to find the test blocks.

### What the endpoint sees

SystemOne is an API for decision models: each question is judged alone against
one state, in one pass, and the answer is a probability, not text. The battery
follows the documented style: one specific judgement per question, one line,
asked the plain way round, with one-line criteria that separate the answers.
Code composes the answers into a verdict and a finding.

The state is the test and nothing else:

1. The test record: the file, the path, the name, the source, the fixtures, and
   the imports. When there are any, also the heads of the enclosing `describe`
   calls and the extractor's notes (`each`, `dynamic-name`, `focus-in-file`), so
   that `runs` can see a `describe.skip` or a focus marker in a sibling test.
2. A capped slice of the non-test diff.

There is no shared rubric: text unrelated to a decision lowers its accuracy, so
each question carries its own definition in its criteria. `can_fail_a` carries:

```json
{
  "true": "yes: some bug in that behaviour fails it",
  "false": "no: it passes whatever the code does, as with a tautology, both sides from the code, or an assertion that never runs"
}
```

The reply holds `probabilities` and `confidence` for each answer; some
endpoints also report `mass`. Each endpoint computes `confidence` its own way,
so the tool reads the probabilities and `mass` instead.

### The battery

The battery is 15 yes/no questions about one test, from 11 checks. All questions
share one state and travel in one call. There is no choice question: two
decision models picked the last option of a choice in either order. Each check
is a folder in `checks/`, and `checks/index.mjs` sets the order. The role of a
check tells the verdict rules in `classifier/verdict.mjs` what to do with its
answers, so a new check needs only its folder and one line in `checks/index.mjs`.

| Check | Questions | Role | Looks for | Cases |
| --- | --- | --- | --- | --- |
| [`can-fail`](checks/can-fail/check.mjs) | `can_fail_a`, `can_fail_c` | can-fail | tautology, self-reference, vacuous test, passes-with-zero | 9 |
| [`asserts`](checks/asserts/check.mjs) | `asserts_exact`, `asserts_written`, `asserts_same`, `asserts_shape`, `asserts_mock` | asserts | no exact value, expected value read from the same code as the result, shape only, or interaction only; code picks the kind from the five answers | 14 |
| [`positive`](checks/positive/check.mjs) | `positive_a`, `positive_b` | gate: no positive assertion | only-negative test | 7 |
| [`runs`](checks/runs/check.mjs) | none: the extractor's `skipped` and `focus-in-file` flags | runs: does not run, or narrows the run | a skip, todo, or x marker on the test or on a describe around it, or an only or focus marker anywhere in the file | 6 |
| [`conditional`](checks/conditional/check.mjs) | `conditional` | flag `conditional` | a branch, a loop over a value that may be empty, an early return, or a catch that can leave an assertion unrun | 3 |
| [`isolated`](checks/isolated/check.mjs) | `isolated` | flag `order-dependent` | a value another test sets, or a shared object no hook resets | 2 |
| [`deterministic`](checks/deterministic/check.mjs) | `deterministic` | flag `non-deterministic` | a sleep, the real clock, real randomness, an unguaranteed order, or a service the test does not start | 9 |
| [`automated`](checks/automated/check.mjs) | `automated` | flag `manual` | a print-only test, or a step a person must do | 2 |
| [`restores`](checks/restores/check.mjs) | `restores` | flag `state-leak` | a global, environment variable, timer, mock, or shared object left changed | 3 |
| [`resilient`](checks/resilient/check.mjs) | `resilient` | flag `structure-dependent` | an internal import, a spy on a helper, a private member, or a pinned internal call order | 4 |
| [`verdict`](checks/verdict/check.mjs) | none: computed | verdict | slop, weak, or good, from the answers above; its cases are the clean and the mixed tests, and the cases of the smells the battery no longer asks | 46 |

Four checks carry the verdict: `can_fail`, `asserts`, `positive`, and `runs`.
`can_fail` and `positive` ask their judgement twice, in two plain phrasings: a
decision model answers a negation less reliably, so no phrasing is negated. A
pair whose phrasings disagree beyond the band escalates, so one confident wrong
answer cannot pass a test alone. `asserts` asks one yes/no question per
property, and code picks the kind; answers that contradict each other escalate.
`runs` asks nothing: a marker is syntax, so the extractor reads it. The other 6
questions are the descriptive questions; each one raises a flag.

The verdict is not asked; code computes it. Slop: the test cannot fail, or takes
its expected value from the same code as its result. Weak: it checks no exact
value, or only a shape, a mock call, or its input, or has no positive
assertion. Good: otherwise. "Cannot fail" beside a behaviour assertion is a
contradiction, and escalates.

### Trust

The tool trusts an answer in two ways:

- `mass` says whether the endpoint answered at all. An answer with a `mass`
  below `TEST_AUDIT_MIN_MASS` is untrusted.
- The spread says whether the judgement survives rewording. `can_fail` and
  `positive` each ask their judgement twice, and the tool compares the two
  answers. A spread above `TEST_AUDIT_STABLE_BAND` means the judgement is
  unstable. The `asserts` facts are not reworded: they name different
  properties, agree or contradict each other, and a contradiction escalates.
  `runs` asks nothing, so nothing can drift.

## Calibrate

```sh
node test-audit/cli.mjs --selftest          # live calibration over the labelled corpus
node test-audit/cli.mjs --selftest --targets "http://127.0.0.1:11434|nimble, http://127.0.0.1:11435|winnow:e4b"
node test-audit/cli.mjs --selftest --models "nimble,tev1"   # several models on one URL
node test-audit/cli.mjs --selftest --cases "result-keys,adds two numbers"   # only these cases, by folder or test name
node test-audit/cli.mjs --selftest --benchmark   # a per-case report, in markdown
```

`--selftest` runs the labelled cases in `checks/*/cases/` against the configured
endpoint and reports agreement with the labels; the machinery is in
`calibration/`. The cases cover each named defect, clean tests of the common
types, and mixed cases that should escalate. A target in `--targets` is
`url|model`, or a bare `model` for the configured URL. The selftest exits `0`
when every target passes acceptance, and `1` when one fails.

A case sends the model what a real audit sends: the test, and, when the case
folder holds a `code.mjs`, the code under test as the change context, through
the same cap (`calibration/case-state.mjs`). Give a case its `code.mjs` when
the right answer depends on the code: a test that asserts `taxRates()` equals
`TAX_RATES` agrees by construction only if `taxRates()` returns that same
constant. The model sees neutral paths (`example.test.mjs`, `src/example.mjs`),
because the path of a case states its label, and it sees only the test call, so
the header comment of `case.mjs` can name the defect and its source.

A `label.json` holds the test name, the known `defect`, the expected `canFail`,
`mustEscalate` and `mixed`, and a `note`, and can name a check and the value it
must give, such as `"deterministic": false` or `"asserts": "behaviour"`. Give
each check at least one case where its good answer is right and one where its
bad answer is right, so a question the model misreads shows on both sides. A
descriptive check only raises a flag, so its label value is the only thing that
measures it.

A run passes acceptance when all of these hold:

- No defect case passes silently.
- Every mixed case escalates.
- Every labelled case resolves to a test in its case file, and the endpoint
  answers it. A transport failure is not a routed case.
- The `can_fail` agreement is 90% or more (`calibration/judge.mjs`).

The tool does not score the answer of a case that escalated as unstable, because
it did not commit to a value; the same holds for a check value a label names. It
reports the check agreement per check, but that is not an acceptance rule. A
case whose check value differs from its label shows as **WRONG check**.

`--benchmark` prints a markdown report: a summary (headline numbers, one row per
defect family, the check agreement, links to the cases that are not OK); one
table row per case, not-OK first; one collapsible block per case with the test
source, the code under test if any, the label in plain words, each escalation
reason tied to the answers behind it, and one line for the descriptive
questions; and a legend with the questions from the battery.

Run the selftest again when the model or a question changes. Record each run in
[`BENCHMARK.md`](BENCHMARK.md), with the command above the report.

## Limits

- Agreement between paraphrases is necessary, not sufficient. A shared error in
  all phrasings still passes. The corpus and the escalation path carry that risk.
- Only the mutation check can prove `passes-for-the-wrong-reason`. The tool can
  suspect it, from an interaction-only assertion or a remote fixture. It cannot
  prove it.
- When the endpoint reports no `mass`, the trust floor cannot apply. The
  paraphrase spread and the cross-question rule are then the only guard.
- The tool judges tests, not coverage. It never says a change is tested enough;
  it says whether each added test is a real guard.
- The Python extractor reads pytest and unittest files (`test_*.py`,
  `*_test.py`, or a `.py` under a `tests` folder, never `conftest.py`): a
  module-level `test*` function, async too, and the `test*` methods of a class
  named `Test*` or based on a `TestCase`. A `@pytest.fixture` function, a
  `setUp` or `setup_method`, and the module and class constants travel with each
  test. An unconditional skip (`@pytest.mark.skip`, `@unittest.skip`, a module
  `pytestmark`) flags it as skipped; a `skipif` or `skipUnless` does not, because
  the test runs where its condition holds, and `parametrize` or hypothesis's
  `given` as `each`. Fixtures in `conftest.py` are not read.
- The JavaScript extractor reads `test` and `it` calls with a literal or a
  computed name, with a member chain such as `test.skip.each` or
  `test.skipIf(cond)`, and node:test's `suite`, `before` and `after` beside
  `describe` and its hooks. It folds a `test.each` table into one test and flags
  a computed name. It does not match the tagged-template form, the generic form
  (`test.each<T>`), or a test called on a runner object (`t.test(...)`). In JSX,
  an apostrophe in element text (`<p>Don't</p>`) can still hide the test that
  holds it.

## References

Each check names its sources in the header comment of its
`checks/<check>/check.mjs`. [`references.md`](references.md) is the index to all
the sources, and it lists the background reading.
