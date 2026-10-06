# test-audit

test-audit checks each test that a change adds. It asks a SystemOne endpoint the
questions a reviewer asks about the test, and it prints one verdict per test. If
a test needs a closer look, the tool escalates it to a human.

The tool is a cheap sensor. It separates a real guard from fake safety. It does
not prove that a change is tested. For that proof, use
[`verify-prd-implemented`](../verify-prd-implemented/SKILL.md). That skill breaks
the behaviour of the code and checks that the named test fails.

The [OpenCode plugin](#opencode-plugin) in `opencode/` runs this tool inside
OpenCode, and installs from this directory.

## Layout

The tool has one folder per check. A check is one judgement the tool asks the
model about a test: one question, or a set of phrasings of one judgement. The
folder holds all of the check: its questions, its rubric definition, its role in
the verdict, its sources, and the calibration cases meant to catch its defect.

```
test-audit/
  checks/                 one folder per check
    index.mjs             puts the checks together: the battery and the rubric
    checks.test.mjs       keeps the folders, the battery, and the cases in step
    rubric.snapshot.txt   the rubric the model sees, byte for byte
    battery.snapshot.json the questions the model sees, byte for byte
    runs/
      check.mjs           the questions, the rubric definition, the role; its header names the sources
      cases/
        skip-token/
          case.mjs        the test; its header names the defect and the sources, and the model never sees it
          label.json      the known defect and the expected outcome
          code.mjs        the code under test, if the right answer depends on it
    can-fail/  asserts/  positive/  type/  verdict/  and 18 descriptive checks
  change/                 read the diff and find the tests
  classifier/             ask one SystemOne call per test, and apply the verdict rules
  report/                 print a verdict, a summary, and an exit code
  calibration/            run the cases against an endpoint, and judge the run
  opencode/               the OpenCode plugin
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
- The paraphrases disagree. The spread of the `can_fail_*` set, the `runs_*`
  pair, or the `positive_*` pair is above `TEST_AUDIT_STABLE_BAND`, or
  `asserts_a` and `asserts_b` differ.
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
`magic-number`, `asserts-input`, `manual`, and `state-leak`. An `asserts` kind
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
| `TEST_AUDIT_STATE_CAP` | `8000` | characters in one test state |
| `TEST_AUDIT_CHANGE_CAP` | `3000` | characters of non-test diff context |

## OpenCode plugin

[`opencode/index.ts`](opencode/index.ts) is an [OpenCode](https://opencode.ai) 2
plugin that runs this tool. The plugin installs from this directory, so it
carries the core modules it imports:

```sh
opencode plugin add 'github:Vortiago/Verktoykasse#main::path:test-audit'
```

- Run `/test-audit`. It audits the working-tree change against the default
  branch and posts the report into the chat.
- Let the agent call the `test-audit` tool. The agent can set `base`, `head`,
  `staged` or `files` to scope the audit. The tool returns the same markdown
  report.

The plugin audits the project directory of the session
(`ctx.location.directory`) and reads the same environment variables as the CLI.
It imports `audit.mjs` and `report/index.mjs` directly and spawns no shell.

The plugin is advisory. It reports a verdict for each test, and it never blocks a
run. OpenCode plugin hooks have no git-commit event and no deny decision, so the
plugin cannot block a commit. A blocking pre-push hook ships only after the
corpus proves the questions trustworthy, and it will live beside the CLI, not in
the plugin.

`package.json` lists the files an install needs in `files`: the runtime modules,
`checks/index.mjs` and each `checks/<check>/check.mjs`, `opencode/index.ts`,
`types.d.ts`, this README and the licence. The calibration cases, the benchmark
and the tests stay out. The plugin has its own type gate, which
installs `@opencode/plugin` into `node_modules/`:

```sh
cd test-audit && node opencode/check.mjs
```

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

The battery is 29 questions about one test, from 24 checks. All questions share
one state and travel in one call. Each check is a folder in `checks/`, and
`checks/index.mjs` sets the order. The role of a check tells the verdict rules
in `classifier/verdict.mjs` what to do with its answers. So a new check needs
only its folder and one line in `checks/index.mjs`.

| Check | Questions | Role | Looks for | Cases |
| --- | --- | --- | --- | --- |
| [`can-fail`](checks/can-fail/check.mjs) | `can_fail_a`, `can_fail_b` (negated), `can_fail_c` | can-fail | tautology, self-reference, vacuous test, passes-with-zero | 9 |
| [`asserts`](checks/asserts/check.mjs) | `asserts_a`, `asserts_b` (order swapped) | asserts | hardcoded data, shape only, interaction only, nothing | 12 |
| [`positive`](checks/positive/check.mjs) | `positive_a`, `positive_b` (negated) | gate: no positive assertion | only-negative test | 5 |
| [`runs`](checks/runs/check.mjs) | `runs_a`, `runs_b` (negated) | gate: does not run | a skip, todo, only, or focus marker on the test, on a describe around it, or on another test in the file | 4 |
| [`type`](checks/type/check.mjs) | `type` | type | unit, integration, regression, e2e, smoke, characterization | 0 |
| [`observable`](checks/observable/check.mjs) | `observable` | flag `implementation-coupled` | private internals, call order, exact collaborator interactions | 0 |
| [`conditional`](checks/conditional/check.mjs) | `conditional` | flag `conditional` | a branch, loop, or catch that can leave the assertion unrun | 1 |
| [`isolated`](checks/isolated/check.mjs) | `isolated` | flag `order-dependent` | interacting tests, shared mutable state, order dependence | 0 |
| [`controlled`](checks/controlled/check.mjs) | `controlled` | flag `uncontrolled-resource` | an assumed network, clock, filesystem, or environment | 0 |
| [`specific`](checks/specific/check.mjs) | `specific` | flag `weak-assert` | a weak assertion, where a more specific one is possible | 0 |
| [`named`](checks/named/check.mjs) | `named` | flag `vague-name` | a vague name that states no behaviour and no result | 0 |
| [`deterministic`](checks/deterministic/check.mjs) | `deterministic` | flag `non-deterministic` | a sleep, the clock, the network, randomness, order | 6 |
| [`one-thing`](checks/one-thing/check.mjs) | `one_thing` | flag `eager` | several unrelated behaviours in one body | 2 |
| [`name-matches`](checks/name-matches/check.mjs) | `name_matches` | flag `name-mismatch` | name-only test: the body asserts something other than the name | 4 |
| [`resilient`](checks/resilient/check.mjs) | `resilient` | flag `structure-dependent` | a behaviour-preserving refactor breaks the test | 0 |
| [`diagnostic`](checks/diagnostic/check.mjs) | `diagnostic` | flag `silent-failure` | assertion roulette: a failure does not say which assertion failed | 0 |
| [`fixture`](checks/fixture/check.mjs) | `fixture` | flag `general-fixture` | a general fixture, or data the test does not need | 0 |
| [`fast`](checks/fast/check.mjs) | `fast` | flag `slow` | a sleep, heavy I/O, or a large computation | 0 |
| [`readable`](checks/readable/check.mjs) | `readable` | flag `obscure` | a reader must open the code under test to follow it | 0 |
| [`magic-number`](checks/magic-number/check.mjs) | `magic_number` | flag `magic-number` | a bare value the reader must decode | 0 |
| [`reads-output`](checks/reads-output/check.mjs) | `reads_output` | flag `asserts-input` | the assertion reads its own input or setup, or only that no error was thrown | 2 |
| [`automated`](checks/automated/check.mjs) | `automated` | flag `manual` | a step a person must do, or output a person must read | 0 |
| [`restores`](checks/restores/check.mjs) | `restores` | flag `state-leak` | state left behind for the next test | 0 |
| [`verdict`](checks/verdict/check.mjs) | `verdict` | verdict | slop, weak, good, strong; its cases are the clean and the mixed tests | 16 |

Five answers carry the verdict: the `positive_*` pair, the `runs_*` pair, the
`can_fail_*` set, the `asserts_*` pair, and `verdict`. Each pair holds one
negated twin, so one confident wrong answer cannot pass a test alone. A pair
whose phrasings disagree beyond the band escalates, like `can_fail`. The other
18 questions are the descriptive questions. Each one raises a flag.

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

`--selftest` runs the labelled cases in `checks/*/cases/` against the configured
endpoint and reports agreement with the labels. The machinery is in
`calibration/`. The cases cover each named defect, clean tests of the common
types, and mixed cases that should escalate. A target in `--targets` is
`url|model`, or a bare `model` for the configured URL.

A case sends the model what a real audit sends: the test, and, when the case
folder holds a `code.mjs`, the code under test as the change context. Give a
case its `code.mjs` when the right answer depends on the code. For example, a
test that asserts `taxRates()` equals `TAX_RATES` agrees by construction only if
`taxRates()` returns that same constant. The model sees neutral paths
(`example.test.mjs`, `src/example.mjs`), because the path of a case states its
label. The model sees only the test call, so the header comment of `case.mjs`
can name the defect and its source.

A run passes acceptance when all of these are true:

- No defect case passes silently.
- Every mixed case escalates.
- Every labelled case resolves to a test in its case file, and the endpoint
  answers it. A transport failure is not a routed case.
- The `can_fail` agreement is 90% or more (set in `calibration/judge.mjs`).

The selftest exits `0` when every target passes acceptance, and `1` when one
fails. The tool does not score the `can_fail` answer of a case that escalated as
unstable, because the tool did not commit to a value.

`--benchmark` prints the run as a markdown report, in this order:

1. A summary: the headline numbers, one row for each defect family, and links
   to the cases that are not OK.
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
