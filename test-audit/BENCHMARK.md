# test-audit benchmark

Date: 2026-10-06.

Command:

```sh
TEST_AUDIT_CONCURRENCY=3 TEST_AUDIT_TIMEOUT_MS=600000 node cli.mjs --selftest --benchmark \
  --targets "http://koishi.tail6defbc.ts.net:8090|qwen3.8-flash-next-mtp"
```

> **Re-rendered from the recorded run.** A script rendered this file in the current layout from the results of the run above. It changed no result.
> The recorded run kept no probabilities, so an answer shows no number. It also kept no answer for `positive`, `type`, or each `can_fail` phrasing. These show as "not recorded". The `positive` row still shows its recorded escalation reason.
> The next `node cli.mjs --selftest --benchmark` run fills in the missing values.
>
> **The numbers are a baseline, not the current result.** The code has changed since the recorded run. The test state no longer carries the case file name, and the `resilient` question has new words. Run the benchmark again to get the current result.

This file records a calibration run of `test-audit` over the labelled corpus. Each case is one test with a known defect, or a clean test. The legend under the summary explains the terms.

## Summary: qwen3.8-flash-next-mtp

Endpoint `http://koishi.tail6defbc.ts.net:8090`, model `qwen3.8-flash-next-mtp`. 62 cases, 62 calls, 54914 tokens.

| Measure | Result | Meaning |
| --- | --- | --- |
| Cases | 62 | The labelled tests in the corpus. |
| Silent passes | 0 | Defect cases that did not escalate. Must be 0. |
| False positives | 4 of 18 | Cases that should pass, but escalated. Lower is better. |
| can_fail agreement | 38 of 39 (97%) | The can_fail answers that match the label. Only the cases where the tool committed to a value count. Must be 90% or more. |
| Mixed routed | 5 of 5 | Mixed cases that escalated. Must be all. |
| deterministic agreement | 6 of 8 | The deterministic answers that match the label. Not an acceptance rule. |
| Unresolved | 0 | Cases with no test or no answer. Must be 0. |
| Acceptance | **PASS** | PASS when each "must" in this table holds. |

### Defect families

| Family | Cases | Escalated | Expected | OK |
| --- | --- | --- | --- | --- |
| ambiguous | 5 | 5 | escalate | yes |
| clean | 11 | 0 | pass | yes |
| commented-out | 2 | 2 | escalate | yes |
| eager | 2 | 0 | pass | yes |
| early-return | 1 | 1 | escalate | yes |
| focused | 2 | 2 | escalate | yes |
| hardcoded-data | 2 | 2 | escalate | yes |
| interaction-only | 3 | 3 | escalate | yes |
| name-only | 4 | 4 | escalate | yes |
| non-deterministic | 6 | 4 | 5 pass, 1 either | **no**: 4 FALSE positive |
| only-negative | 4 | 4 | escalate | yes |
| passes-with-zero | 2 | 2 | escalate | yes |
| self-reference | 3 | 3 | escalate | yes |
| shape-only | 4 | 4 | escalate | yes |
| skipped | 3 | 3 | escalate | yes |
| tautology | 2 | 2 | escalate | yes |
| vacuous | 2 | 2 | escalate | yes |
| wrong-reason | 4 | 3 | 2 escalate, 2 either | **no**: 1 WRONG can_fail |

**Not OK:** [35. `the remote catalogue lists the widget`](#case-35) FALSE positive · [36. `the retry lands within the window`](#case-36) FALSE positive · [37. `the sorter keeps every random value`](#case-37) FALSE positive · [38. `the token has not expired yet`](#case-38) FALSE positive · [60. `normalise keeps the title text`](#case-60) WRONG can_fail.

## Legend

- **Case**: one labelled test in `calibration/cases/`. Its **label** in `calibration/labels/` states the known defect and the expected outcome.
- **Escalate**: the tool sends the test to a human. The test then **needs eyes**. Each **reason** says why.
- **Verdict-carrying question**: a question whose answer can escalate the test.
- **Descriptive question**: a question whose "no" raises a **flag**. A flag describes the test. It does not escalate the test.
- **can_fail**: the probability that a change to the code under test can make the test fail. The tool asks it three ways (`can_fail_a`, `can_fail_b`, `can_fail_c`) and takes the mean. `can_fail_b` asks the opposite, so its "no" means "can fail".
- **Spread**: the highest minus the lowest of the three can_fail values. A spread above `TEST_AUDIT_STABLE_BAND` makes the value unstable, and the test escalates. A `!` after a can_fail value marks this.
- **asserts**: what the assertion checks. Only `behaviour` is a real guard. `asserts_a` and `asserts_b` give the options in opposite order, and must agree.
- **Answer**: for a yes/no question, the number in brackets is the probability of yes. For a choice, it is the probability of the chosen option. For the verdict, it is the score from 0 (slop) to 3 (strong).
- **not recorded**: the run did not record this value. **unanswered**: the endpoint gave no answer. **untrusted**: the answer has a `mass` below `TEST_AUDIT_MIN_MASS`.
- **Status** of a case:
  - **OK**: the outcome matches the label.
  - **SILENT pass**: a defect case did not escalate. Acceptance fails.
  - **MIXED not routed**: a mixed case did not escalate. Acceptance fails.
  - **FALSE positive**: a case that should pass escalated.
  - **WRONG can_fail**: the tool committed to the wrong can_fail value.
  - **NO ANSWER**: the endpoint gave no trusted answer. Acceptance fails.
  - **NO TEST**: the case file holds no test with this name. Acceptance fails.

## Cases: qwen3.8-flash-next-mtp

<a id="case-1"></a>

### 1. `builds the graph`: OK

Case file: [`calibration/cases/mixed-shape.case.mjs`](calibration/cases/mixed-shape.case.mjs), line 2. Label group: `baseline`.

```js
test("builds the graph", () => {
  const graph = build();
  expect(Array.isArray(graph.nodes)).toBe(true);
  expect(graph.nodes.length).toBeGreaterThan(0);
})
```

**Known defect: ambiguous.** It is a mixed case. Its answers can disagree, so the tool should escalate it. The label sets no `can_fail` value. Note: two shape assertions.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.34!, spread 0.96 (unstable) | escalates: can_fail unstable (spread 0.96) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | no | flag `magic-number` |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.96); asserts shape-only; verdict weak.
- Expected: escalate (a mixed case).
- Status: **OK**, the outcome matches the label.

<a id="case-2"></a>

### 2. `collects the graph nodes`: OK

Case file: [`calibration/cases/mixed-graph-shapes.case.mjs`](calibration/cases/mixed-graph-shapes.case.mjs), line 2. Label group: `mixed`.

```js
test("collects the graph nodes", () => {
  const nodes = collect(graph);
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBeGreaterThan(0);
})
```

**Known defect: ambiguous.** It is a mixed case. Its answers can disagree, so the tool should escalate it. The label sets no `can_fail` value. Note: Both assertions check the shape and never the node values, so the paraphrased gates disagree.

Sources: [self-consistency: paraphrased gates](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.33!, spread 0.96 (unstable) | escalates: can_fail unstable (spread 0.96) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | no | flag `magic-number` |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.96); asserts shape-only; verdict weak.
- Expected: escalate (a mixed case).
- Status: **OK**, the outcome matches the label.

<a id="case-3"></a>

### 3. `retries once`: OK

Case file: [`calibration/cases/mixed-mock.case.mjs`](calibration/cases/mixed-mock.case.mjs), line 2. Label group: `baseline`.

```js
test("retries once", () => {
  const fn = mock(flakyOperation);
  retry(fn);
  expect(fn).toHaveBeenCalledTimes(2);
})
```

**Known defect: ambiguous.** It is a mixed case. Its answers can disagree, so the tool should escalate it. The label sets no `can_fail` value. Note: interaction assertion with a specific count.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.79!, spread 0.41 (borderline) | escalates: can_fail borderline (spread 0.41) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | interaction-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | interaction-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | interaction-only | escalates: asserts interaction-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | no | flag `implementation-coupled` |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | no | flag `structure-dependent` |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: can_fail borderline (spread 0.41); no positive assertion; asserts interaction-only; verdict weak.
- Expected: escalate (a mixed case).
- Status: **OK**, the outcome matches the label.

<a id="case-4"></a>

### 4. `the schema is sound`: OK

Case file: [`calibration/cases/mixed-world-shape.case.mjs`](calibration/cases/mixed-world-shape.case.mjs), line 2. Label group: `mixed`.

```js
test("the schema is sound", () => {
  expect(true).toBe(true);
  expect(schema.fields.length).toBeGreaterThan(0);
})
```

**Known defect: ambiguous.** It is a mixed case. Its answers can disagree, so the tool should escalate it. The label sets no `can_fail` value. Note: A tautology sits beside a weak shape assertion, so the paraphrased gates disagree.

Sources: [self-consistency: paraphrased gates](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.19!, spread 0.54 (unstable) | escalates: can_fail unstable (spread 0.54) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing versus shape-only | escalates: asserts unstable (nothing vs shape-only) |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | no | flag `eager` |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | no | flag `structure-dependent` |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | no | flag `magic-number` |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.54); asserts unstable (nothing vs shape-only); verdict slop.
- Expected: escalate (a mixed case).
- Status: **OK**, the outcome matches the label.

<a id="case-5"></a>

### 5. `the world is sane`: OK

Case file: [`calibration/cases/mixed-tautology.case.mjs`](calibration/cases/mixed-tautology.case.mjs), line 2. Label group: `baseline`.

```js
test("the world is sane", () => {
  expect(true).toBe(true);
  expect(add.length).toBeGreaterThan(0);
})
```

**Known defect: ambiguous.** It is a mixed case. Its answers can disagree, so the tool should escalate it. The label sets no `can_fail` value. Note: half tautology, half weak shape assertion.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.01, spread 0.01 (stable) | - |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | nothing | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing | escalates: asserts nothing |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | no | flag `implementation-coupled` |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | no | flag `eager` |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | no | flag `structure-dependent` |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: asserts nothing; verdict slop.
- Expected: escalate (a mixed case).
- Status: **OK**, the outcome matches the label.

<a id="case-6"></a>

### 6. `add handles negatives`: OK

Case file: [`calibration/cases/good-unit-add.case.mjs`](calibration/cases/good-unit-add.case.mjs), line 2. Label group: `baseline`.

```js
test("add handles negatives", () => {
  expect(add(-2, -3)).toBe(-5);
})
```

**Known defect: none.** It is a clean test. The tool should pass it, with no escalation. `can_fail` should be yes. `deterministic` should be yes. Note: a clean unit guard.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | as expected |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-7"></a>

### 7. `converts minutes to seconds`: OK

Case file: [`calibration/cases/good-unit-seconds.case.mjs`](calibration/cases/good-unit-seconds.case.mjs), line 2. Label group: `good`.

```js
test("converts minutes to seconds", () => {
  expect(toSeconds(3)).toBe(180);
})
```

**Known defect: none.** It is a clean test. The tool should pass it, with no escalation. `can_fail` should be yes. Note: a real guard.

Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-8"></a>

### 8. `formats a receipt line`: OK

Case file: [`calibration/cases/good-characterization-receipt.case.mjs`](calibration/cases/good-characterization-receipt.case.mjs), line 2. Label group: `good`.

```js
test("formats a receipt line", () => {
  expect(formatReceiptLine("Coffee", 2, 3.5)).toBe("Coffee x2 @ 3.50 = 7.00");
})
```

**Known defect: none.** It is a clean test. The tool should pass it, with no escalation. `can_fail` should be yes. Note: a real guard.

Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-9"></a>

### 9. `regression #42: a single import resolves`: OK

Case file: [`calibration/cases/good-regression.case.mjs`](calibration/cases/good-regression.case.mjs), line 2. Label group: `baseline`.

```js
test("regression #42: a single import resolves", () => {
  expect(parseImports('import a from "b";')).toEqual([{ name: "a", from: "b" }]);
})
```

**Known defect: none.** It is a clean test. The tool should pass it, with no escalation. `can_fail` should be yes. Note: a clean regression guard.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-10"></a>

### 10. `regression #77: a trimmed name keeps its inner spaces`: OK

Case file: [`calibration/cases/good-regression-whitespace.case.mjs`](calibration/cases/good-regression-whitespace.case.mjs), line 2. Label group: `good`.

```js
test("regression #77: a trimmed name keeps its inner spaces", () => {
  expect(trimName("  Ada  Lovelace  ")).toBe("Ada  Lovelace");
})
```

**Known defect: none.** It is a clean test. The tool should pass it, with no escalation. `can_fail` should be yes. Note: a real guard.

Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-11"></a>

### 11. `reverses a string`: OK

Case file: [`calibration/cases/good-unit-reverse.case.mjs`](calibration/cases/good-unit-reverse.case.mjs), line 2. Label group: `baseline`.

```js
test("reverses a string", () => {
  expect(reverse("abc")).toBe("cba");
})
```

**Known defect: none.** It is a clean test. The tool should pass it, with no escalation. `can_fail` should be yes. `deterministic` should be yes. Note: a clean unit guard.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | as expected |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-12"></a>

### 12. `slugs a display name`: OK

Case file: [`calibration/cases/good-unit-slug.case.mjs`](calibration/cases/good-unit-slug.case.mjs), line 2. Label group: `good`.

```js
test("slugs a display name", () => {
  expect(slugify("Hello, World")).toBe("hello-world");
})
```

**Known defect: none.** It is a clean test. The tool should pass it, with no escalation. `can_fail` should be yes. Note: a real guard.

Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-13"></a>

### 13. `store round trips a value`: OK

Case file: [`calibration/cases/good-integration.case.mjs`](calibration/cases/good-integration.case.mjs), line 2. Label group: `baseline`.

```js
test("store round trips a value", async () => {
  const store = await openStore(tmpdir());
  await store.set("k", "v");
  expect(await store.get("k")).toBe("v");
})
```

**Known defect: none.** It is a clean test. The tool should pass it, with no escalation. `can_fail` should be yes. Note: a clean integration guard.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | no | flag `uncontrolled-resource` |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | no | flag `state-leak` |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-14"></a>

### 14. `the cache returns a stored value`: OK

Case file: [`calibration/cases/good-integration-cache.case.mjs`](calibration/cases/good-integration-cache.case.mjs), line 2. Label group: `good`.

```js
test("the cache returns a stored value", async () => {
  const cache = await openCache(tmpdir());
  await cache.put("session", "abc123");
  expect(await cache.get("session")).toBe("abc123");
})
```

**Known defect: none.** It is a clean test. The tool should pass it, with no escalation. `can_fail` should be yes. Note: a real guard.

Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | no | flag `state-leak` |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-15"></a>

### 15. `the server answers health`: OK

Case file: [`calibration/cases/good-e2e.case.mjs`](calibration/cases/good-e2e.case.mjs), line 2. Label group: `baseline`.

```js
test("the server answers health", async () => {
  const res = await fetch(base + "/health");
  expect(await res.text()).toBe("ok");
})
```

**Known defect: none.** It is a clean test. The tool should pass it, with no escalation. `can_fail` should be yes. Note: a clean end-to-end guard.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | no | flag `uncontrolled-resource` |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | no | flag `non-deterministic` |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-16"></a>

### 16. `the service reports its version`: OK

Case file: [`calibration/cases/good-e2e-version.case.mjs`](calibration/cases/good-e2e-version.case.mjs), line 2. Label group: `good`.

```js
test("the service reports its version", async () => {
  const res = await fetch(base + "/version");
  expect(await res.text()).toBe("2.4.1");
})
```

**Known defect: none.** It is a clean test. The tool should pass it, with no escalation. `can_fail` should be yes. Note: a real guard.

Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | no | flag `uncontrolled-resource` |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | no | flag `non-deterministic` |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-17"></a>

### 17. `merges the options`: OK

Case file: [`calibration/cases/disabled-comment-merge.case.mjs`](calibration/cases/disabled-comment-merge.case.mjs), line 2. Label group: `naming`.

```js
test("merges the options", () => {
  // expect(mergeOptions({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  expect(true).toBe(true);
})
```

**Known defect: commented-out.** The tool should escalate it. `can_fail` should be no. Note: The real assertion is commented out, beside a tautology.

Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | nothing | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing | escalates: asserts nothing |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: no positive assertion; asserts nothing; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-18"></a>

### 18. `parses config`: OK

Case file: [`calibration/cases/commented-out.case.mjs`](calibration/cases/commented-out.case.mjs), line 2. Label group: `baseline`.

```js
test("parses config", () => {
  // expect(parseConfig("a=1")).toEqual({ a: "1" });
  expect(true).toBe(true);
})
```

**Known defect: commented-out.** The tool should escalate it. The label sets no `can_fail` value. Note: commented-out assertion beside a tautology.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.00, spread 0.00 (stable) | - |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | nothing | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing | escalates: asserts nothing |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | no | flag `silent-failure` |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: no positive assertion; asserts nothing; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-19"></a>

### 19. `creating a user validates, stores and notifies`: OK

Case file: [`calibration/cases/scope-unrelated.case.mjs`](calibration/cases/scope-unrelated.case.mjs), line 2. Label group: `scope`.

```js
test("creating a user validates, stores and notifies", async () => {
  const store = new MemoryStore();
  const notifier = new SpyNotifier();
  const user = createUser(store, notifier, { name: "Ada" });
  expect(user.name).toBe("Ada");
  expect(await store.get(user.id)).toEqual(user);
  expect(notifier.sent).toHaveLength(1);
})
```

**Known defect: eager.** The tool should pass it, with no escalation. `can_fail` should be yes. Note: A real user-creation check, but validation, storage and notification are three unrelated behaviours.

Sources: [Meszaros, xUnit Test Patterns (Eager Test)](http://xunitpatterns.com/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.99, spread 0.02 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | no | flag `eager` |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-20"></a>

### 20. `the pipeline parses, formats and lints`: OK

Case file: [`calibration/cases/scope-three-features.case.mjs`](calibration/cases/scope-three-features.case.mjs), line 2. Label group: `scope`.

```js
test("the pipeline parses, formats and lints", () => {
  const ast = parse("const x=1");
  const formatted = format(ast);
  const warnings = lint(ast);
  expect(ast.type).toBe("Program");
  expect(formatted).toBe("const x = 1;\n");
  expect(warnings).toEqual([]);
})
```

**Known defect: eager.** The tool should pass it, with no escalation. `can_fail` should be yes. Note: A real pipeline check, but parse, format and lint are three features asserted in one body.

Sources: [Meszaros, xUnit Test Patterns (Eager Test)](http://xunitpatterns.com/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | no | flag `eager` |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-21"></a>

### 21. `rejects a blank name`: OK

Case file: [`calibration/cases/disabled-early-return-name.case.mjs`](calibration/cases/disabled-early-return-name.case.mjs), line 2. Label group: `naming`.

```js
test("rejects a blank name", () => {
  return;
  expect(validateName("")).toBe(false);
})
```

**Known defect: early-return.** The tool should escalate it. `can_fail` should be no. Note: The early return makes the assertion unreachable, so the test cannot fail.

Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.01, spread 0.01 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | nothing | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing | escalates: asserts nothing |
| `runs` | yes: it runs | no | escalates: does not run |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | no | flag `conditional` |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | no | flag `silent-failure` |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: does not run; asserts nothing; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-22"></a>

### 22. `loads the draft`: OK

Case file: [`calibration/cases/disabled-focus-draft.case.mjs`](calibration/cases/disabled-focus-draft.case.mjs), line 6. Label group: `naming`.

```js
it("loads the draft", () => {
  expect(loadDraft("draft")).toEqual("draft");
})
```

Extractor notes: `focus-in-file`.

**Known defect: focused.** The tool should escalate it. The label sets no `can_fail` value. Note: The plain test inherits the file-level focus from it.only.

Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.84!, spread 0.32 (borderline) | escalates: can_fail borderline (spread 0.32) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | hardcoded-data | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | hardcoded-data versus behaviour | escalates: asserts unstable (hardcoded-data vs behaviour) |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | good | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **good**.
- Needs eyes: **yes**. Reasons: can_fail borderline (spread 0.32); asserts unstable (hardcoded-data vs behaviour).
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-23"></a>

### 23. `saves the draft`: OK

Case file: [`calibration/cases/disabled-focus-draft.case.mjs`](calibration/cases/disabled-focus-draft.case.mjs), line 2. Label group: `naming`.

```js
it.only("saves the draft", () => {
  expect(saveDraft("draft")).toBe(true);
})
```

Extractor notes: `focus-in-file`.

**Known defect: focused.** The tool should escalate it. The label sets no `can_fail` value. Note: The it.only focuses the file and narrows the whole run.

Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.97, spread 0.05 (stable) | - |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | no | escalates: does not run |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: does not run; verdict weak.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-24"></a>

### 24. `resolves the status labels`: OK

Case file: [`calibration/cases/asserts-status-table.case.mjs`](calibration/cases/asserts-status-table.case.mjs), line 2. Label group: `asserts`.

```js
test("resolves the status labels", () => {
  expect(statusLabels()).toEqual(STATUS_LABELS);
})
```

**Known defect: hardcoded-data.** The tool should escalate it. `can_fail` should be no. Note: The expected value is the code under test own constant, so the test agrees by construction and cannot fail.

Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.87!, spread 0.30 (borderline) | escalates: can_fail borderline (spread 0.30) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | hardcoded-data | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | hardcoded-data | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | hardcoded-data | escalates: asserts hardcoded-data |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | good | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **good**.
- Needs eyes: **yes**. Reasons: can_fail borderline (spread 0.30); asserts hardcoded-data.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-25"></a>

### 25. `taxes the standard rate`: OK

Case file: [`calibration/cases/asserts-constant-copy.case.mjs`](calibration/cases/asserts-constant-copy.case.mjs), line 2. Label group: `asserts`.

```js
test("taxes the standard rate", () => {
  expect(taxRates()).toEqual(TAX_RATES);
})
```

**Known defect: hardcoded-data.** The tool should escalate it. `can_fail` should be no. Note: The expected value is the code under test own constant, so the test agrees by construction and cannot fail.

Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.12, spread 0.19 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | hardcoded-data | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | hardcoded-data | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | hardcoded-data | escalates: asserts hardcoded-data |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: asserts hardcoded-data; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-26"></a>

### 26. `forwards the payload`: OK

Case file: [`calibration/cases/asserts-mock-argument.case.mjs`](calibration/cases/asserts-mock-argument.case.mjs), line 2. Label group: `asserts`.

```js
test("forwards the payload", () => {
  const spy = mock(send);
  dispatch(message);
  expect(spy.mock.calls[0][0]).toMatchObject({ id: expect.any(String) });
})
```

**Known defect: interaction-only.** The tool should escalate it. `can_fail` should be yes. Note: The mock argument shape can change and fail the test, while the real output stays unchecked.

Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.55!, spread 0.63 (unstable) | escalates: can_fail unstable (spread 0.63) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | interaction-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | interaction-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | interaction-only | escalates: asserts interaction-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | no | flag `implementation-coupled` |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | no | flag `structure-dependent` |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | no | flag `state-leak` |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.63); asserts interaction-only; verdict weak.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-27"></a>

### 27. `notifies the listener`: OK

Case file: [`calibration/cases/asserts-spy-called.case.mjs`](calibration/cases/asserts-spy-called.case.mjs), line 2. Label group: `asserts`.

```js
test("notifies the listener", () => {
  const spy = mock(notify);
  publish(event);
  expect(spy).toHaveBeenCalled();
})
```

**Known defect: interaction-only.** The tool should escalate it. `can_fail` should be yes. Note: A missing call fails the test, though the mock stands in for behaviour it never verifies.

Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.76!, spread 0.52 (unstable) | escalates: can_fail unstable (spread 0.52) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | interaction-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | interaction-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | interaction-only | escalates: asserts interaction-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | no | flag `implementation-coupled` |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | no | flag `structure-dependent` |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | no | flag `state-leak` |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.52); asserts interaction-only; verdict weak.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-28"></a>

### 28. `publishes twice`: OK

Case file: [`calibration/cases/asserts-spy-count.case.mjs`](calibration/cases/asserts-spy-count.case.mjs), line 2. Label group: `asserts`.

```js
test("publishes twice", () => {
  const spy = mock(publish);
  runBatch(items);
  expect(spy).toHaveBeenCalledTimes(2);
})
```

**Known defect: interaction-only.** The tool should escalate it. `can_fail` should be yes. Note: A changed call count fails the test, yet the payload of each call is never asserted.

Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.95, spread 0.11 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | interaction-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | interaction-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | interaction-only | escalates: asserts interaction-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | no | flag `implementation-coupled` |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | no | flag `structure-dependent` |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | no | flag `state-leak` |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: asserts interaction-only; verdict weak.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-29"></a>

### 29. `computes the tax`: OK

Case file: [`calibration/cases/name-only.case.mjs`](calibration/cases/name-only.case.mjs), line 2. Label group: `baseline`.

```js
test("computes the tax", () => {
  const tax = computeTax(100);
  expect(tax).toBeDefined();
})
```

**Known defect: name-only.** The tool should escalate it. `can_fail` should be no. Note: name-only: toBeDefined is true for any defined value.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.03, spread 0.09 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | no | flag `silent-failure` |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: no positive assertion; asserts shape-only; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-30"></a>

### 30. `computes the tax due`: OK

Case file: [`calibration/cases/naming-tax-defined.case.mjs`](calibration/cases/naming-tax-defined.case.mjs), line 2. Label group: `naming`.

```js
test("computes the tax due", () => {
  const tax = computeTax(100);
  expect(tax).toBeDefined();
})
```

**Known defect: name-only.** The tool should escalate it. `can_fail` should be no. Note: The name promises a tax value, while toBeDefined is true for any defined value.

Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.01, spread 0.03 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | no | flag `silent-failure` |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: no positive assertion; asserts shape-only; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-31"></a>

### 31. `sorts rows by name`: OK

Case file: [`calibration/cases/naming-sort-length.case.mjs`](calibration/cases/naming-sort-length.case.mjs), line 2. Label group: `naming`.

```js
test("sorts rows by name", () => {
  const rows = sortRows([{ name: "b" }, { name: "a" }]);
  expect(rows).toHaveLength(2);
})
```

**Known defect: name-only.** The tool should escalate it. `can_fail` should be no. Note: The name promises a sort, while the length check holds for any permutation.

Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.18!, spread 0.53 (unstable) | escalates: can_fail unstable (spread 0.53) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.53); asserts shape-only; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-32"></a>

### 32. `validates email addresses`: OK

Case file: [`calibration/cases/naming-email-truthy.case.mjs`](calibration/cases/naming-email-truthy.case.mjs), line 2. Label group: `naming`.

```js
test("validates email addresses", () => {
  expect(isValidEmail("a@b.com")).toBeTruthy();
})
```

**Known defect: name-only.** The tool should escalate it. `can_fail` should be no. Note: The name promises validation, while a truthy check passes for any non-empty value.

Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.69!, spread 0.80 (unstable) | escalates: can_fail unstable (spread 0.80) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.80); asserts shape-only; verdict weak.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-33"></a>

### 33. `debounce fires once`: OK

Case file: [`calibration/cases/flaky.case.mjs`](calibration/cases/flaky.case.mjs), line 2. Label group: `baseline`.

```js
test("debounce fires once", async () => {
  const calls = [];
  const debounced = debounce(() => calls.push(1), 20);
  debounced();
  await sleep(50);
  expect(calls.length).toBe(1);
})
```

**Known defect: non-deterministic.** The label does not say if the tool should escalate it. `can_fail` should be yes. `deterministic` should be no. Note: a real guard, but timer-bound; reported, not escalated.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.99, spread 0.02 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | good | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | no | flag `uncontrolled-resource` |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | no | as expected; flag `non-deterministic` |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | no | flag `slow` |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | no | flag `magic-number` |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **good**.
- Needs eyes: **no**.
- Expected: either (the label does not say).
- Status: **OK**, the outcome matches the label.

<a id="case-34"></a>

### 34. `the metric keys keep their insertion order`: OK

Case file: [`calibration/cases/determinism-order.case.mjs`](calibration/cases/determinism-order.case.mjs), line 2. Label group: `determinism`.

```js
test("the metric keys keep their insertion order", () => {
  const metrics = collectMetrics({ z: 1, a: 2 });
  expect(Object.keys(metrics)).toEqual(["z", "a"]);
})
```

**Known defect: non-deterministic.** The tool should pass it, with no escalation. `can_fail` should be yes. `deterministic` should be no. Note: A real metrics check, but it pins key order that the structure does not guarantee.

Sources: [Kent Beck, Test Desiderata (deterministic)](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.99, spread 0.01 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | **not as expected** (label: no) |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: pass.
- Status: **OK**, the outcome matches the label.

<a id="case-35"></a>

### 35. `the remote catalogue lists the widget`: FALSE positive

Case file: [`calibration/cases/determinism-network.case.mjs`](calibration/cases/determinism-network.case.mjs), line 2. Label group: `determinism`.

```js
test("the remote catalogue lists the widget", async () => {
  const response = await fetch("https://example.test/catalogue");
  const items = await response.json();
  expect(items).toContain("widget");
})
```

**Known defect: non-deterministic.** The tool should pass it, with no escalation. `can_fail` should be yes. `deterministic` should be no. Note: A real catalogue check, but a live fetch makes the result depend on the network.

Sources: [Kent Beck, Test Desiderata (deterministic)](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.84, spread 0.20 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | no | flag `uncontrolled-resource` |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | no | as expected; flag `non-deterministic` |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | no | flag `slow` |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: verdict weak.
- Expected: pass.
- Status: **FALSE positive**, a case that should pass escalated.

<a id="case-36"></a>

### 36. `the retry lands within the window`: FALSE positive

Case file: [`calibration/cases/determinism-timer.case.mjs`](calibration/cases/determinism-timer.case.mjs), line 2. Label group: `determinism`.

```js
test("the retry lands within the window", async () => {
  const attempts = [];
  retryOnFailure(() => attempts.push(1));
  await sleep(50);
  expect(attempts.length).toBe(2);
})
```

**Known defect: non-deterministic.** The tool should pass it, with no escalation. `can_fail` should be yes. `deterministic` should be no. Note: A real guard on the retry count, but the fixed sleep makes the outcome depend on scheduling.

Sources: [Kent Beck, Test Desiderata (deterministic)](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.76!, spread 0.60 (unstable) | escalates: can_fail unstable (spread 0.60) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour versus shape-only | escalates: asserts unstable (behaviour vs shape-only) |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | no | flag `implementation-coupled` |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | no | flag `uncontrolled-resource` |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | no | as expected; flag `non-deterministic` |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | no | flag `structure-dependent` |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | no | flag `slow` |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | no | flag `magic-number` |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | no | flag `state-leak` |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.60); asserts unstable (behaviour vs shape-only); verdict weak.
- Expected: pass.
- Status: **FALSE positive**, a case that should pass escalated.

<a id="case-37"></a>

### 37. `the sorter keeps every random value`: FALSE positive

Case file: [`calibration/cases/determinism-randomness.case.mjs`](calibration/cases/determinism-randomness.case.mjs), line 2. Label group: `determinism`.

```js
test("the sorter keeps every random value", () => {
  const input = Array.from({ length: 5 }, () => Math.floor(Math.random() * 100));
  expect(sortNumbers(input)).toEqual([...input].sort((a, b) => a - b));
})
```

**Known defect: non-deterministic.** The tool should pass it, with no escalation. `can_fail` should be yes. `deterministic` should be no. Note: A real sorting property, but the random input makes a failure hard to reproduce.

Sources: [Kent Beck, Test Desiderata (deterministic)](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.96, spread 0.06 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | hardcoded-data | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | hardcoded-data versus behaviour | escalates: asserts unstable (hardcoded-data vs behaviour) |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | good | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | no | flag `uncontrolled-resource` |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | **not as expected** (label: no) |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **good**.
- Needs eyes: **yes**. Reasons: asserts unstable (hardcoded-data vs behaviour).
- Expected: pass.
- Status: **FALSE positive**, a case that should pass escalated.

<a id="case-38"></a>

### 38. `the token has not expired yet`: FALSE positive

Case file: [`calibration/cases/determinism-clock.case.mjs`](calibration/cases/determinism-clock.case.mjs), line 2. Label group: `determinism`.

```js
test("the token has not expired yet", () => {
  const token = issueToken({ ttlMs: 60_000 });
  expect(token.expiresAt).toBeGreaterThan(Date.now());
})
```

**Known defect: non-deterministic.** The tool should pass it, with no escalation. `can_fail` should be yes. `deterministic` should be no. Note: A real expiry check, but reading Date.now makes the result depend on when the test runs.

Sources: [Kent Beck, Test Desiderata (deterministic)](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.87!, spread 0.28 (borderline) | escalates: can_fail borderline (spread 0.28) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | no | flag `uncontrolled-resource` |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | no | as expected; flag `non-deterministic` |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: can_fail borderline (spread 0.28); verdict weak.
- Expected: pass.
- Status: **FALSE positive**, a case that should pass escalated.

<a id="case-39"></a>

### 39. `finds no imports in an empty file`: OK

Case file: [`calibration/cases/onlynegative-empty-array.case.mjs`](calibration/cases/onlynegative-empty-array.case.mjs), line 2. Label group: `wrongreason`.

```js
test("finds no imports in an empty file", () => {
  expect(findImports("")).toEqual([]);
})
```

**Known defect: only-negative.** The tool should escalate it. `can_fail` should be yes. Note: Only the empty result is checked, so a finder that never finds anything would pass.

Sources: [verify-prd-implemented test-patterns (Passes for the wrong reason; No negative/positive pair)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **yes**. Reasons: no positive assertion.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-40"></a>

### 40. `no edge for a comment`: OK

Case file: [`calibration/cases/only-negative.case.mjs`](calibration/cases/only-negative.case.mjs), line 2. Label group: `baseline`.

```js
test("no edge for a comment", () => {
  expect(resolveEdges("// comment")).toBeNull();
})
```

**Known defect: only-negative.** The tool should escalate it. `can_fail` should be yes. Note: no positive/negative pair.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.98, spread 0.04 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **yes**. Reasons: no positive assertion.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-41"></a>

### 41. `parses a well formed header`: OK

Case file: [`calibration/cases/onlynegative-no-throw.case.mjs`](calibration/cases/onlynegative-no-throw.case.mjs), line 2. Label group: `wrongreason`.

```js
test("parses a well formed header", () => {
  const run = () => parseHeader("content-length: 12");
  expect(run).not.toThrow();
})
```

**Known defect: only-negative.** The tool should escalate it. `can_fail` should be yes. Note: Only that the call does not throw is checked, and the parsed output is never asserted.

Sources: [verify-prd-implemented test-patterns (Passes for the wrong reason; No negative/positive pair)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.25!, spread 0.70 (unstable) | escalates: can_fail unstable (spread 0.70) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | nothing | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing | escalates: asserts nothing |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.70); no positive assertion; asserts nothing; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-42"></a>

### 42. `returns null for an unknown setting`: OK

Case file: [`calibration/cases/onlynegative-absent-key.case.mjs`](calibration/cases/onlynegative-absent-key.case.mjs), line 2. Label group: `wrongreason`.

```js
test("returns null for an unknown setting", () => {
  expect(readSetting({ theme: "dark" }, "font")).toBeNull();
})
```

**Known defect: only-negative.** The tool should escalate it. `can_fail` should be yes. Note: Only the absent lookup is checked, so a reader that always returns null would pass.

Sources: [verify-prd-implemented test-patterns (Passes for the wrong reason; No negative/positive pair)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.01 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **yes**. Reasons: no positive assertion.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-43"></a>

### 43. `events are dispatched`: OK

Case file: [`calibration/cases/falsifiability-empty-dispatch.case.mjs`](calibration/cases/falsifiability-empty-dispatch.case.mjs), line 2. Label group: `falsifiability`.

```js
test("events are dispatched", () => {
  const dispatched = collect();
  expect(dispatched).toBeDefined();
})
```

**Known defect: passes-with-zero.** The tool should escalate it. `can_fail` should be no. Note: The check only asks whether the collection is defined, so no dispatch passes.

Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.01, spread 0.01 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing versus shape-only | escalates: asserts unstable (nothing vs shape-only) |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | no | flag `silent-failure` |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: no positive assertion; asserts unstable (nothing vs shape-only); verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-44"></a>

### 44. `imports are folded`: OK

Case file: [`calibration/cases/vacuous-zero.case.mjs`](calibration/cases/vacuous-zero.case.mjs), line 2. Label group: `baseline`.

```js
test("imports are folded", () => {
  const commit = buildCommit([]);
  expect(commit.imports).toBeDefined();
})
```

**Known defect: passes-with-zero.** The tool should escalate it. `can_fail` should be no. Note: vacuous: passes when the feature produces nothing.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.02, spread 0.07 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | no | flag `silent-failure` |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: no positive assertion; asserts shape-only; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-45"></a>

### 45. `parse is stable`: OK

Case file: [`calibration/cases/falsifiability-self-parse.case.mjs`](calibration/cases/falsifiability-self-parse.case.mjs), line 2. Label group: `falsifiability`.

```js
test("parse is stable", () => {
  expect(parse(src)).toEqual(parse(src));
})
```

**Known defect: self-reference.** The tool should escalate it. `can_fail` should be no. Note: Both sides call the same production function, so the comparison is true by construction.

Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.00, spread 0.01 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | nothing | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing | escalates: asserts nothing |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: asserts nothing; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-46"></a>

### 46. `reader round trips`: OK

Case file: [`calibration/cases/tautology-selfreference.case.mjs`](calibration/cases/tautology-selfreference.case.mjs), line 2. Label group: `baseline`.

```js
test("reader round trips", () => {
  expect(parse(source)).toEqual(parse(source));
})
```

**Known defect: self-reference.** The tool should escalate it. `can_fail` should be no. Note: tautology: both sides call the same production code.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.00, spread 0.01 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | nothing | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing | escalates: asserts nothing |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | no | flag `uncontrolled-resource` |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: asserts nothing; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-47"></a>

### 47. `the two totals match`: OK

Case file: [`calibration/cases/falsifiability-helper-agreement.case.mjs`](calibration/cases/falsifiability-helper-agreement.case.mjs), line 2. Label group: `falsifiability`.

```js
test("the two totals match", () => {
  expect(total(rows)).toBe(total(rows));
})
```

**Known defect: self-reference.** The tool should escalate it. `can_fail` should be no. Note: One helper backs both sides, so any change to it moves both sides together.

Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | nothing | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing | escalates: asserts nothing |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | no | flag `magic-number` |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: asserts nothing; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-48"></a>

### 48. `builds three steps`: OK

Case file: [`calibration/cases/asserts-result-length.case.mjs`](calibration/cases/asserts-result-length.case.mjs), line 2. Label group: `asserts`.

```js
test("builds three steps", () => {
  const steps = planSteps(task);
  expect(steps.length).toBe(3);
})
```

**Known defect: shape-only.** The tool should escalate it. `can_fail` should be yes. Note: A wrong count fails the test, yet the step contents are never checked.

Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.88, spread 0.22 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | no | flag `magic-number` |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: asserts shape-only; verdict weak.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-49"></a>

### 49. `loads the profile fields`: OK

Case file: [`calibration/cases/asserts-result-keys.case.mjs`](calibration/cases/asserts-result-keys.case.mjs), line 2. Label group: `asserts`.

```js
test("loads the profile fields", () => {
  const profile = loadProfile(id);
  expect(Object.keys(profile)).toEqual(["name", "email", "age"]);
})
```

**Known defect: shape-only.** The tool should escalate it. `can_fail` should be yes. Note: The keys can change and fail the test, but the field values pass unexamined.

Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.97, spread 0.07 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | good | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | no | flag `uncontrolled-resource` |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **good**.
- Needs eyes: **yes**. Reasons: asserts shape-only.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-50"></a>

### 50. `planner returns roads`: OK

Case file: [`calibration/cases/shape-not-value.case.mjs`](calibration/cases/shape-not-value.case.mjs), line 2. Label group: `baseline`.

```js
test("planner returns roads", () => {
  const roads = plan();
  expect(Array.isArray(roads)).toBe(true);
  expect(roads.length).toBe(3);
})
```

**Known defect: shape-only.** The tool should escalate it. `can_fail` should be yes. Note: shape-not-value: a shape change can fail it, the content is never checked.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.63!, spread 0.85 (unstable) | escalates: can_fail unstable (spread 0.85) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | weak | escalates: verdict weak |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | no | flag `magic-number` |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **weak**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.85); asserts shape-only; verdict weak.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-51"></a>

### 51. `returns a list of routes`: OK

Case file: [`calibration/cases/asserts-result-array.case.mjs`](calibration/cases/asserts-result-array.case.mjs), line 2. Label group: `asserts`.

```js
test("returns a list of routes", () => {
  const routes = routesFor(graph);
  expect(Array.isArray(routes)).toBe(true);
})
```

**Known defect: shape-only.** The tool should escalate it. `can_fail` should be yes. Note: The array check can fail when the return type changes, but no route value is ever asserted.

Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.27!, spread 0.80 (unstable) | escalates: can_fail unstable (spread 0.80) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.80); asserts shape-only; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-52"></a>

### 52. `handles overflow`: OK

Case file: [`calibration/cases/skipped.case.mjs`](calibration/cases/skipped.case.mjs), line 2. Label group: `baseline`.

```js
test.skip("handles overflow", () => {
  expect(add(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER + 1);
})
```

**Known defect: skipped.** The tool should escalate it. The label sets no `can_fail` value. Note: skipped: the test never runs.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.10, spread 0.16 (stable) | - |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | no | escalates: does not run |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: does not run; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-53"></a>

### 53. `parses a dotted key`: OK

Case file: [`calibration/cases/disabled-xit-key.case.mjs`](calibration/cases/disabled-xit-key.case.mjs), line 2. Label group: `naming`.

```js
xit("parses a dotted key", () => {
  expect(parseKey("a.b")).toEqual(["a", "b"]);
})
```

**Known defect: skipped.** The tool should escalate it. The label sets no `can_fail` value. Note: The test is marked xit, so it never runs.

Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.39!, spread 0.51 (unstable) | escalates: can_fail unstable (spread 0.51) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | no | escalates: does not run |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.51); does not run; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-54"></a>

### 54. `rejects a stale token`: OK

Case file: [`calibration/cases/disabled-skip-token.case.mjs`](calibration/cases/disabled-skip-token.case.mjs), line 2. Label group: `naming`.

```js
test.skip("rejects a stale token", () => {
  expect(verifyToken("expired")).toBe(false);
})
```

**Known defect: skipped.** The tool should escalate it. The label sets no `can_fail` value. Note: The test is marked skipped, so it never runs.

Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.04, spread 0.08 (stable) | - |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing versus behaviour | escalates: asserts unstable (nothing vs behaviour) |
| `runs` | yes: it runs | no | escalates: does not run |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: does not run; asserts unstable (nothing vs behaviour); verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-55"></a>

### 55. `the build is green`: OK

Case file: [`calibration/cases/falsifiability-constant-truth.case.mjs`](calibration/cases/falsifiability-constant-truth.case.mjs), line 2. Label group: `falsifiability`.

```js
test("the build is green", () => {
  expect(true).toBe(true);
})
```

**Known defect: tautology.** The tool should escalate it. `can_fail` should be no. Note: The assertion holds for every build, so breaking the code cannot fail it.

Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | nothing | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing | escalates: asserts nothing |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: asserts nothing; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-56"></a>

### 56. `the world is sane`: OK

Case file: [`calibration/cases/tautology-constant.case.mjs`](calibration/cases/tautology-constant.case.mjs), line 2. Label group: `baseline`.

```js
test("the world is sane", () => {
  expect(true).toBe(true);
})
```

**Known defect: tautology.** The tool should escalate it. `can_fail` should be no. Note: tautology: true === true.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.00, spread 0.00 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | nothing | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | nothing | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | nothing | escalates: asserts nothing |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | no | flag `implementation-coupled` |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: asserts nothing; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-57"></a>

### 57. `the queue is not negative`: OK

Case file: [`calibration/cases/falsifiability-count-nonnegative.case.mjs`](calibration/cases/falsifiability-count-nonnegative.case.mjs), line 2. Label group: `falsifiability`.

```js
test("the queue is not negative", () => {
  expect(queue.length).toBeGreaterThanOrEqual(0);
})
```

**Known defect: vacuous.** The tool should escalate it. `can_fail` should be no. Note: A length is never negative, so the bound is always true.

Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.03, spread 0.02 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: no positive assertion; asserts shape-only; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-58"></a>

### 58. `the summary is produced`: OK

Case file: [`calibration/cases/falsifiability-aggregate-exists.case.mjs`](calibration/cases/falsifiability-aggregate-exists.case.mjs), line 2. Label group: `falsifiability`.

```js
test("the summary is produced", () => {
  const summary = summarise(rows);
  expect(summary.totals).toBeDefined();
})
```

**Known defect: vacuous.** The tool should escalate it. `can_fail` should be no. Note: The aggregate exists, but no value inside it is ever read.

Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.16!, spread 0.44 (borderline) | escalates: can_fail borderline (spread 0.44) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | shape-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | shape-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | shape-only | escalates: asserts shape-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | no | flag `vague-name` |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: can_fail borderline (spread 0.44); asserts shape-only; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.

<a id="case-59"></a>

### 59. `builds a job with the given name`: OK

Case file: [`calibration/cases/wrongreason-passthrough-argument.case.mjs`](calibration/cases/wrongreason-passthrough-argument.case.mjs), line 2. Label group: `wrongreason`.

```js
test("builds a job with the given name", () => {
  const job = buildJob({ name: "nightly", steps: [] });
  expect(job.name).toBe("nightly");
})
```

**Known defect: wrong-reason.** The label does not say if the tool should escalate it. `can_fail` should be yes. Note: The asserted field is copied from the argument, so a stub that only copies would pass. Only the mutation check proves this, so escalation is welcome but not required.

Sources: [verify-prd-implemented test-patterns (Passes for the wrong reason; No negative/positive pair)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 1.00, spread 0.01 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | strong | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **strong**.
- Needs eyes: **no**.
- Expected: either (the label does not say).
- Status: **OK**, the outcome matches the label.

<a id="case-60"></a>

### 60. `normalise keeps the title text`: WRONG can_fail

Case file: [`calibration/cases/wrongreason-asserts-input.case.mjs`](calibration/cases/wrongreason-asserts-input.case.mjs), line 2. Label group: `wrongreason`.

```js
test("normalise keeps the title text", () => {
  const input = { title: "  hello  " };
  normalise(input);
  expect(input.title).toBe("  hello  ");
})
```

**Known defect: wrong-reason.** The tool should escalate it. `can_fail` should be yes. Note: The assertion holds because it reads the input object, not the value the code returned.

Sources: [verify-prd-implemented test-patterns (Passes for the wrong reason; No negative/positive pair)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.05, spread 0.05 (stable) | **WRONG**: the label says yes |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | hardcoded-data | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | hardcoded-data | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | hardcoded-data | escalates: asserts hardcoded-data |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | no | flag `structure-dependent` |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: asserts hardcoded-data; verdict slop.
- Expected: escalate.
- Status: **WRONG can_fail**, the tool committed to the wrong can_fail value.

<a id="case-61"></a>

### 61. `reports no booking for a free slot`: OK

Case file: [`calibration/cases/wrongreason-absent-record.case.mjs`](calibration/cases/wrongreason-absent-record.case.mjs), line 2. Label group: `wrongreason`.

```js
test("reports no booking for a free slot", () => {
  const calendar = new Calendar();
  expect(calendar.bookingAt("2026-11-01T09:00")).toBeNull();
})
```

**Known defect: wrong-reason.** The label does not say if the tool should escalate it. `can_fail` should be yes. Note: The lookup is empty only because the fixture never creates the booking it queries. Only the mutation check proves this, so escalation is welcome but not required.

Sources: [verify-prd-implemented test-patterns (Passes for the wrong reason; No negative/positive pair)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.97, spread 0.06 (stable) | matches the label |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | behaviour | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | behaviour | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | behaviour | - |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | escalates: no positive assertion |
| `verdict` | scale: slop, weak, good, strong | good | - |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | yes | - |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | yes | - |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | yes | - |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | yes | - |
| `diagnostic` | yes: the failure names the assertion and the expected value | yes | - |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | yes | - |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | yes | - |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | yes | - |

**Outcome**

- Verdict: **good**.
- Needs eyes: **yes**. Reasons: no positive assertion.
- Expected: either (the label does not say).
- Status: **OK**, the outcome matches the label.

<a id="case-62"></a>

### 62. `saves the user`: OK

Case file: [`calibration/cases/wrong-reason-mock.case.mjs`](calibration/cases/wrong-reason-mock.case.mjs), line 2. Label group: `baseline`.

```js
test("saves the user", () => {
  const spy = mock(saveUser);
  save(user);
  expect(spy).toHaveBeenCalled();
})
```

**Known defect: wrong-reason.** The tool should escalate it. `can_fail` should be yes. Note: passes for the wrong reason: only the mock call is checked.

**Verdict-carrying questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `can_fail_a` | yes: a change to the code under test can make it fail | not recorded | - |
| `can_fail_b` | yes: it passes even when the behaviour is broken | not recorded | - |
| `can_fail_c` | yes: the assertion can catch a regression in the behaviour | not recorded | - |
| *can_fail* | the mean probability that the test can fail, over the 3 phrasings, and their spread | mean 0.47!, spread 0.59 (unstable) | escalates: can_fail unstable (spread 0.59) |
| `asserts_a` | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing | interaction-only | - |
| `asserts_b` | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour | interaction-only | - |
| *asserts* | `asserts_a` and `asserts_b` agree on `behaviour` | interaction-only | escalates: asserts interaction-only |
| `runs` | yes: it runs | yes | - |
| `positive` | yes: it asserts the positive case | not recorded | - |
| `verdict` | scale: slop, weak, good, strong | slop | escalates: verdict slop |

**Descriptive questions**

| Question | Checks | Answer | Effect |
| --- | --- | --- | --- |
| `type` | one of: unit, integration, regression, e2e, smoke, characterization | not recorded | - |
| `observable` | yes: it checks behaviour a caller could observe | no | flag `implementation-coupled` |
| `conditional` | yes: the assertion always runs | yes | - |
| `isolated` | yes: it is independent of other tests and of run order | yes | - |
| `controlled` | yes: its inputs and resources are controlled | yes | - |
| `specific` | yes: the assertion is specific to the expected value | no | flag `weak-assert` |
| `named` | yes: the name states the behaviour and the expected result | yes | - |
| `deterministic` | yes: it gives the same result every run | yes | - |
| `one_thing` | yes: it checks one behaviour | yes | - |
| `name_matches` | yes: the body asserts the behaviour the name promises | no | flag `name-mismatch` |
| `resilient` | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green | no | flag `structure-dependent` |
| `diagnostic` | yes: the failure names the assertion and the expected value | no | flag `silent-failure` |
| `fixture` | yes: it builds only the data it needs | yes | - |
| `fast` | yes: it runs fast | yes | - |
| `readable` | yes: the test reads clearly on its own | no | flag `obscure` |
| `magic_number` | yes: the values are named or self-explanatory | yes | - |
| `reads_output` | yes: it asserts the returned or observed output | no | flag `asserts-input` |
| `automated` | yes: it is self-checking and unattended | yes | - |
| `restores` | yes: it clears or restores what it changes | no | flag `state-leak` |

**Outcome**

- Verdict: **slop**.
- Needs eyes: **yes**. Reasons: can_fail unstable (spread 0.59); asserts interaction-only; verdict slop.
- Expected: escalate.
- Status: **OK**, the outcome matches the label.
