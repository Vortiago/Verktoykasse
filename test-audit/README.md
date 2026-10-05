# test-audit

A [SystemOne](https://github.com/Vortiago) classifier for the tests a change
adds. It asks the in-house typed-question endpoint on llama-arbiter (Koishi) the
questions a reviewer asks, one verdict per test, and routes slop and unstable
judgments to a human.

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

| Question | Type | Detects |
| --- | --- | --- |
| `can_fail_a` | yes/no | tautology, vacuous, passes-with-zero |
| `can_fail_b` | yes/no, negated twin | the same judgment, asked the other way |
| `can_fail_c` | yes/no | the same judgment, phrased directly |
| `asserts_a` | choice | shape-not-value, mock-only, hardcoded data, nothing |
| `asserts_b` | choice, order swapped | position control for `asserts_a` |
| `type` | choice | unit, integration, regression, e2e, smoke, characterization |
| `deterministic` | yes/no | sleep, time, network, order dependence |
| `one_thing` | yes/no | eager test |
| `name_matches` | yes/no | name-only test |
| `verdict` | score | slop, weak, good, strong |

The three `can_fail_*` phrasings are logically equivalent and polarity
normalised. A spread above `TEST_AUDIT_STABLE_BAND` is instability, not a tie to
break. The live calibration showed why this matters: a single phrasing once
called a tautology falsifiable at 0.92 with mass 0.99; its twins said 0.00 and
0.12, and the spread routed it.

### Static flags

`skipped` / `focused`, an empty body, no assertion at all, and a commented-out
assertion escalate without a model call. `roulette` (several assertions, no
message) and the descriptive gates (`non-deterministic`, `eager`,
`name-mismatch`) report as flags and do not escalate.

## Use

```sh
node test-audit/cli.mjs                     # the working tree against the default branch
node test-audit/cli.mjs --base main         # the merge base of main and HEAD
node test-audit/cli.mjs --staged            # the staged change
node test-audit/cli.mjs --files a.test.mjs  # named files
node test-audit/cli.mjs --json              # the full record
node test-audit/cli.mjs --markdown          # a review comment
node test-audit/cli.mjs --selftest          # live calibration over corpus/
```

Exit code `0` means every test was classified and none needs eyes. Exit `1`
means a test is slop, weak, or unstable. Exit `2` means a usage or transport
failure. A transport failure is an audit failure, not a skip.

## Config

| Variable | Default | Meaning |
| --- | --- | --- |
| `TEST_AUDIT_ARBITER_URL` | `http://koishi.tail6defbc.ts.net:8090` | arbiter base |
| `TEST_AUDIT_MODEL` | `qwen3.8-flash-next-mtp` | the gate model |
| `TEST_AUDIT_MIN_MASS` | `0.5` | trust floor per answer |
| `TEST_AUDIT_STABLE_BAND` | `0.25` | paraphrase spread ceiling |
| `TEST_AUDIT_CONCURRENCY` | `3` | calls in flight; the router queues |
| `TEST_AUDIT_TIMEOUT_MS` | `120000` | per call |
| `TEST_AUDIT_STATE_CAP` | `8000` | characters per test state |
| `TEST_AUDIT_CHANGE_CAP` | `3000` | characters of non-test diff context |

## Calibration

`node cli.mjs --selftest` runs the labelled corpus in `corpus/` against the live
arbiter and reports agreement. The corpus draws on the house bad-test catalogue
and the wider literature: a case for each named pattern, clean tests of the
common types, and three deliberately mixed cases whose expected outcome is
escalation.

A run on 2026-10-05, model `qwen3.8-flash-next-mtp`, 18 cases:

| Metric | Result |
| --- | --- |
| `can_fail` agreement | 5/5 resolved (100%) |
| Silent passes | 0 |
| Mixed cases routed | 3/3 |
| False positives on good tests | 0/5 |

A case that routes as unstable is not scored for agreement: the tool did not
commit to a value, it escalated. Re-run the selftest whenever the gate model or
a phrasing changes.

## Honest limits

- Paraphrase agreement is necessary, not sufficient. Correlated errors still
  pass. The corpus and the escalation path carry that risk.
- `passes-for-the-wrong-reason` is provable only by the mutation check. The
  audit can suspect it (an interaction-only assertion, a remote fixture); it
  cannot prove it.
- The router queues behind a prefill. A call can wait minutes. Concurrency stays
  modest and the timeout patient.
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
corpus/        labelled fixtures and labels
types.d.ts     the shared shapes, and the tsc gate's input
tools/check.mjs  the gate command (from vanilla-web)
tools/js-scan.mjs  the scanner helpers it shares
```

The OpenCode plugin lives in [`../opencode-test-audit`](../opencode-test-audit/README.md).
