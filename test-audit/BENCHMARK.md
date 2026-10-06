# test-audit benchmark

Date: 2026-10-06. Command:

```sh
TEST_AUDIT_CONCURRENCY=3 TEST_AUDIT_TIMEOUT_MS=600000 node cli.mjs --selftest --benchmark \
  --targets "http://koishi.tail6defbc.ts.net:8090|qwen3.8-flash-next-mtp"
```

> **Re-rendered from the recorded run, as a baseline.** A script rendered this file in the current layout from the run above. It changed no result.
> The code has changed since the run, so run the benchmark again for the current result.
>
> The run predates the twin questions and the code under test as context. It asked `runs` and `positive` once each, and sent only the test.
> A code block under a test shows the code under test that a run now sends.
> The run kept no probabilities, and no answer for each phrasing, for `positive` or for `type`. These show as "not recorded".
> Since the run, the test state no longer carries the case file name, and the `resilient` question has new words.

This file records a calibration run of `test-audit` over the labelled corpus. Each case is one test with a known defect, or a clean test. The [legend](#legend) explains the terms.

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

**Not OK:** [1. `the remote catalogue lists the widget`](#case-1) FALSE positive · [2. `the retry lands within the window`](#case-2) FALSE positive · [3. `the sorter keeps every random value`](#case-3) FALSE positive · [4. `the token has not expired yet`](#case-4) FALSE positive · [5. `normalise keeps the title text`](#case-5) WRONG can_fail.

## Cases at a glance: qwen3.8-flash-next-mtp

The cases that are not OK come first, then the others by defect family. A test name links to its details.

| # | Test | Check | Known defect | Expected | Result | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [`the remote catalogue lists the widget`](#case-1) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | weak, needs eyes | **FALSE positive** |
| 2 | [`the retry lands within the window`](#case-2) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | weak, needs eyes | **FALSE positive** |
| 3 | [`the sorter keeps every random value`](#case-3) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | good, needs eyes | **FALSE positive** |
| 4 | [`the token has not expired yet`](#case-4) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | weak, needs eyes | **FALSE positive** |
| 5 | [`normalise keeps the title text`](#case-5) | [`reads-output`](checks/reads-output/check.mjs) | wrong-reason | escalate | slop, needs eyes | **WRONG can_fail** |
| 6 | [`builds the graph`](#case-6) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate (mixed) | weak, needs eyes | OK |
| 7 | [`collects the graph nodes`](#case-7) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate (mixed) | weak, needs eyes | OK |
| 8 | [`retries once`](#case-8) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate (mixed) | weak, needs eyes | OK |
| 9 | [`the schema is sound`](#case-9) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate (mixed) | slop, needs eyes | OK |
| 10 | [`the world is sane`](#case-10) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate (mixed) | slop, needs eyes | OK |
| 11 | [`add handles negatives`](#case-11) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 12 | [`converts minutes to seconds`](#case-12) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 13 | [`formats a receipt line`](#case-13) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 14 | [`regression #42: a single import resolves`](#case-14) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 15 | [`regression #77: a trimmed name keeps its inner spaces`](#case-15) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 16 | [`reverses a string`](#case-16) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 17 | [`slugs a display name`](#case-17) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 18 | [`store round trips a value`](#case-18) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 19 | [`the cache returns a stored value`](#case-19) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 20 | [`the server answers health`](#case-20) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 21 | [`the service reports its version`](#case-21) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 22 | [`merges the options`](#case-22) | [`asserts`](checks/asserts/check.mjs) | commented-out | escalate | slop, needs eyes | OK |
| 23 | [`parses config`](#case-23) | [`asserts`](checks/asserts/check.mjs) | commented-out | escalate | slop, needs eyes | OK |
| 24 | [`creating a user validates, stores and notifies`](#case-24) | [`one-thing`](checks/one-thing/check.mjs) | eager | pass | strong, passes | OK |
| 25 | [`the pipeline parses, formats and lints`](#case-25) | [`one-thing`](checks/one-thing/check.mjs) | eager | pass | strong, passes | OK |
| 26 | [`rejects a blank name`](#case-26) | [`conditional`](checks/conditional/check.mjs) | early-return | escalate | slop, needs eyes | OK |
| 27 | [`loads the draft`](#case-27) | [`runs`](checks/runs/check.mjs) | focused | escalate | good, needs eyes | OK |
| 28 | [`saves the draft`](#case-28) | [`runs`](checks/runs/check.mjs) | focused | escalate | weak, needs eyes | OK |
| 29 | [`resolves the status labels`](#case-29) | [`asserts`](checks/asserts/check.mjs) | hardcoded-data | escalate | good, needs eyes | OK |
| 30 | [`taxes the standard rate`](#case-30) | [`asserts`](checks/asserts/check.mjs) | hardcoded-data | escalate | slop, needs eyes | OK |
| 31 | [`forwards the payload`](#case-31) | [`asserts`](checks/asserts/check.mjs) | interaction-only | escalate | weak, needs eyes | OK |
| 32 | [`notifies the listener`](#case-32) | [`asserts`](checks/asserts/check.mjs) | interaction-only | escalate | weak, needs eyes | OK |
| 33 | [`publishes twice`](#case-33) | [`asserts`](checks/asserts/check.mjs) | interaction-only | escalate | weak, needs eyes | OK |
| 34 | [`computes the tax`](#case-34) | [`name-matches`](checks/name-matches/check.mjs) | name-only | escalate | slop, needs eyes | OK |
| 35 | [`computes the tax due`](#case-35) | [`name-matches`](checks/name-matches/check.mjs) | name-only | escalate | slop, needs eyes | OK |
| 36 | [`sorts rows by name`](#case-36) | [`name-matches`](checks/name-matches/check.mjs) | name-only | escalate | slop, needs eyes | OK |
| 37 | [`validates email addresses`](#case-37) | [`name-matches`](checks/name-matches/check.mjs) | name-only | escalate | weak, needs eyes | OK |
| 38 | [`debounce fires once`](#case-38) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | either | good, passes | OK |
| 39 | [`the metric keys keep their insertion order`](#case-39) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | strong, passes | OK |
| 40 | [`finds no imports in an empty file`](#case-40) | [`positive`](checks/positive/check.mjs) | only-negative | escalate | strong, needs eyes | OK |
| 41 | [`no edge for a comment`](#case-41) | [`positive`](checks/positive/check.mjs) | only-negative | escalate | strong, needs eyes | OK |
| 42 | [`parses a well formed header`](#case-42) | [`positive`](checks/positive/check.mjs) | only-negative | escalate | slop, needs eyes | OK |
| 43 | [`returns null for an unknown setting`](#case-43) | [`positive`](checks/positive/check.mjs) | only-negative | escalate | strong, needs eyes | OK |
| 44 | [`events are dispatched`](#case-44) | [`can-fail`](checks/can-fail/check.mjs) | passes-with-zero | escalate | slop, needs eyes | OK |
| 45 | [`imports are folded`](#case-45) | [`can-fail`](checks/can-fail/check.mjs) | passes-with-zero | escalate | slop, needs eyes | OK |
| 46 | [`parse is stable`](#case-46) | [`can-fail`](checks/can-fail/check.mjs) | self-reference | escalate | slop, needs eyes | OK |
| 47 | [`reader round trips`](#case-47) | [`can-fail`](checks/can-fail/check.mjs) | self-reference | escalate | slop, needs eyes | OK |
| 48 | [`the two totals match`](#case-48) | [`can-fail`](checks/can-fail/check.mjs) | self-reference | escalate | slop, needs eyes | OK |
| 49 | [`builds three steps`](#case-49) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | weak, needs eyes | OK |
| 50 | [`loads the profile fields`](#case-50) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | good, needs eyes | OK |
| 51 | [`planner returns roads`](#case-51) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | weak, needs eyes | OK |
| 52 | [`returns a list of routes`](#case-52) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | slop, needs eyes | OK |
| 53 | [`handles overflow`](#case-53) | [`runs`](checks/runs/check.mjs) | skipped | escalate | slop, needs eyes | OK |
| 54 | [`parses a dotted key`](#case-54) | [`runs`](checks/runs/check.mjs) | skipped | escalate | slop, needs eyes | OK |
| 55 | [`rejects a stale token`](#case-55) | [`runs`](checks/runs/check.mjs) | skipped | escalate | slop, needs eyes | OK |
| 56 | [`the build is green`](#case-56) | [`can-fail`](checks/can-fail/check.mjs) | tautology | escalate | slop, needs eyes | OK |
| 57 | [`the world is sane`](#case-57) | [`can-fail`](checks/can-fail/check.mjs) | tautology | escalate | slop, needs eyes | OK |
| 58 | [`the queue is not negative`](#case-58) | [`can-fail`](checks/can-fail/check.mjs) | vacuous | escalate | slop, needs eyes | OK |
| 59 | [`the summary is produced`](#case-59) | [`can-fail`](checks/can-fail/check.mjs) | vacuous | escalate | slop, needs eyes | OK |
| 60 | [`builds a job with the given name`](#case-60) | [`reads-output`](checks/reads-output/check.mjs) | wrong-reason | either | strong, passes | OK |
| 61 | [`reports no booking for a free slot`](#case-61) | [`positive`](checks/positive/check.mjs) | wrong-reason | either | good, needs eyes | OK |
| 62 | [`saves the user`](#case-62) | [`asserts`](checks/asserts/check.mjs) | wrong-reason | escalate | slop, needs eyes | OK |

## Case details: qwen3.8-flash-next-mtp

Click a case to open it. The cases that are not OK are open.

<details open><summary><a id="case-1"></a>1. <code>the remote catalogue lists the widget</code> · non-deterministic · <b>FALSE positive</b></summary>

```js
test("the remote catalogue lists the widget", async () => {
  const response = await fetch("https://example.test/catalogue");
  const items = await response.json();
  expect(items).toContain("widget");
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no. Note: A real catalogue check, but a live fetch makes the result depend on the network. Case file [`checks/deterministic/cases/network/case.mjs`](checks/deterministic/cases/network/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata (deterministic)](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** weak, needs eyes.
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.84, spread 0.20 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 15 clean · smells: `controlled` (uncontrolled-resource), `deterministic` (non-deterministic), `fast` (slow) · unanswered: none · `type` not recorded · label `deterministic` no: match.
</details>
<details open><summary><a id="case-2"></a>2. <code>the retry lands within the window</code> · non-deterministic · <b>FALSE positive</b></summary>

```js
test("the retry lands within the window", async () => {
  const attempts = [];
  retryOnFailure(() => attempts.push(1));
  await sleep(50);
  expect(attempts.length).toBe(2);
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no. Note: A real guard on the retry count, but the fixed sleep makes the outcome depend on scheduling. Case file [`checks/deterministic/cases/timer/case.mjs`](checks/deterministic/cases/timer/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata (deterministic)](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.76, spread 0.60 (unstable). **Escalates:** can_fail unstable (spread 0.60). Label yes: not scored.
  - `asserts_a` behaviour · `asserts_b` shape-only → asserts: behaviour versus shape-only. **Escalates:** asserts unstable (behaviour vs shape-only).
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 10 clean · smells: `observable` (implementation-coupled), `controlled` (uncontrolled-resource), `deterministic` (non-deterministic), `resilient` (structure-dependent), `fast` (slow), `readable` (obscure), `magic_number` (magic-number), `restores` (state-leak) · unanswered: none · `type` not recorded · label `deterministic` no: match.
</details>
<details open><summary><a id="case-3"></a>3. <code>the sorter keeps every random value</code> · non-deterministic · <b>FALSE positive</b></summary>

```js
test("the sorter keeps every random value", () => {
  const input = Array.from({ length: 5 }, () => Math.floor(Math.random() * 100));
  expect(sortNumbers(input)).toEqual([...input].sort((a, b) => a - b));
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no. Note: A real sorting property, but the random input makes a failure hard to reproduce. Case file [`checks/deterministic/cases/randomness/case.mjs`](checks/deterministic/cases/randomness/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata (deterministic)](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, needs eyes.
  - `asserts_a` hardcoded-data · `asserts_b` behaviour → asserts: hardcoded-data versus behaviour. **Escalates:** asserts unstable (hardcoded-data vs behaviour).
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.96, spread 0.06 (stable). Label yes: match. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` good.
- **Descriptive:** 17 clean · smells: `controlled` (uncontrolled-resource) · unanswered: none · `type` not recorded · **label `deterministic` no, tool yes**.
</details>
<details open><summary><a id="case-4"></a>4. <code>the token has not expired yet</code> · non-deterministic · <b>FALSE positive</b></summary>

```js
test("the token has not expired yet", () => {
  const token = issueToken({ ttlMs: 60_000 });
  expect(token.expiresAt).toBeGreaterThan(Date.now());
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no. Note: A real expiry check, but reading Date.now makes the result depend on when the test runs. Case file [`checks/deterministic/cases/clock/case.mjs`](checks/deterministic/cases/clock/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata (deterministic)](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.87, spread 0.28 (borderline). **Escalates:** can_fail borderline (spread 0.28). Label yes: not scored.
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 16 clean · smells: `controlled` (uncontrolled-resource), `deterministic` (non-deterministic) · unanswered: none · `type` not recorded · label `deterministic` no: match.
</details>
<details open><summary><a id="case-5"></a>5. <code>normalise keeps the title text</code> · wrong-reason · <b>WRONG can_fail</b></summary>

```js
test("normalise keeps the title text", () => {
  const input = { title: "  hello  " };
  normalise(input);
  expect(input.title).toBe("  hello  ");
})
```
Code under test, [`checks/reads-output/cases/asserts-input/code.mjs`](checks/reads-output/cases/asserts-input/code.mjs):

```js
export function normalise(record) {
  return { ...record, title: record.title.trim() };
}
```
- **Known defect:** wrong-reason. **Check:** [`reads-output`](checks/reads-output/check.mjs). **Expected:** escalate, `can_fail` yes. Note: The assertion holds because it reads the input object, not the value the code returned. Case file [`checks/reads-output/cases/asserts-input/case.mjs`](checks/reads-output/cases/asserts-input/case.mjs), line 2. Sources: [verify-prd-implemented test-patterns (Passes for the wrong reason; No negative/positive pair)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.05, spread 0.05 (stable). **WRONG can_fail:** label yes, tool 0.05.
  - `asserts_a` hardcoded-data · `asserts_b` hardcoded-data → asserts: hardcoded-data. **Escalates:** asserts hardcoded-data.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 15 clean · smells: `name_matches` (name-mismatch), `resilient` (structure-dependent), `reads_output` (asserts-input) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-6"></a>6. <code>builds the graph</code> · ambiguous · OK</summary>

```js
test("builds the graph", () => {
  const graph = build();
  expect(Array.isArray(graph.nodes)).toBe(true);
  expect(graph.nodes.length).toBeGreaterThan(0);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: two shape assertions. Case file [`checks/verdict/cases/mixed-shape/case.mjs`](checks/verdict/cases/mixed-shape/case.mjs), line 2.
- **What decided it:** weak, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.34, spread 0.96 (unstable). **Escalates:** can_fail unstable (spread 0.96).
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 13 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `readable` (obscure), `magic_number` (magic-number) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-7"></a>7. <code>collects the graph nodes</code> · ambiguous · OK</summary>

```js
test("collects the graph nodes", () => {
  const nodes = collect(graph);
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBeGreaterThan(0);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: Both assertions check the shape and never the node values, so the paraphrased gates disagree. Case file [`checks/verdict/cases/mixed-graph-shapes/case.mjs`](checks/verdict/cases/mixed-graph-shapes/case.mjs), line 2. Sources: [Wang et al., Self-Consistency Improves Chain of Thought Reasoning (2023): paraphrased gates](https://arxiv.org/abs/2203.11171).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.33, spread 0.96 (unstable). **Escalates:** can_fail unstable (spread 0.96).
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 13 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `readable` (obscure), `magic_number` (magic-number) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-8"></a>8. <code>retries once</code> · ambiguous · OK</summary>

```js
test("retries once", () => {
  const fn = mock(flakyOperation);
  retry(fn);
  expect(fn).toHaveBeenCalledTimes(2);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: interaction assertion with a specific count. Case file [`checks/verdict/cases/mixed-mock/case.mjs`](checks/verdict/cases/mixed-mock/case.mjs), line 2.
- **What decided it:** weak, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.79, spread 0.41 (borderline). **Escalates:** can_fail borderline (spread 0.41).
  - `asserts_a` interaction-only · `asserts_b` interaction-only → asserts: interaction-only. **Escalates:** asserts interaction-only.
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes.
- **Descriptive:** 13 clean · smells: `observable` (implementation-coupled), `name_matches` (name-mismatch), `resilient` (structure-dependent), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-9"></a>9. <code>the schema is sound</code> · ambiguous · OK</summary>

```js
test("the schema is sound", () => {
  expect(true).toBe(true);
  expect(schema.fields.length).toBeGreaterThan(0);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: A tautology sits beside a weak shape assertion, so the paraphrased gates disagree. Case file [`checks/verdict/cases/mixed-world-shape/case.mjs`](checks/verdict/cases/mixed-world-shape/case.mjs), line 2. Sources: [Wang et al., Self-Consistency Improves Chain of Thought Reasoning (2023): paraphrased gates](https://arxiv.org/abs/2203.11171).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.19, spread 0.54 (unstable). **Escalates:** can_fail unstable (spread 0.54).
  - `asserts_a` nothing · `asserts_b` shape-only → asserts: nothing versus shape-only. **Escalates:** asserts unstable (nothing vs shape-only).
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 10 clean · smells: `specific` (weak-assert), `named` (vague-name), `one_thing` (eager), `name_matches` (name-mismatch), `resilient` (structure-dependent), `readable` (obscure), `magic_number` (magic-number), `reads_output` (asserts-input) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-10"></a>10. <code>the world is sane</code> · ambiguous · OK</summary>

```js
test("the world is sane", () => {
  expect(true).toBe(true);
  expect(add.length).toBeGreaterThan(0);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: half tautology, half weak shape assertion. Case file [`checks/verdict/cases/mixed-tautology/case.mjs`](checks/verdict/cases/mixed-tautology/case.mjs), line 2.
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing · `asserts_b` nothing → asserts: nothing. **Escalates:** asserts nothing.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.01, spread 0.01 (stable). `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 10 clean · smells: `observable` (implementation-coupled), `specific` (weak-assert), `named` (vague-name), `one_thing` (eager), `name_matches` (name-mismatch), `resilient` (structure-dependent), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-11"></a>11. <code>add handles negatives</code> · clean · OK</summary>

```js
test("add handles negatives", () => {
  expect(add(-2, -3)).toBe(-5);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` yes. Note: a clean unit guard. Case file [`checks/verdict/cases/good-unit-add/case.mjs`](checks/verdict/cases/good-unit-add/case.mjs), line 2.
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded · label `deterministic` yes: match.
</details>
<details><summary><a id="case-12"></a>12. <code>converts minutes to seconds</code> · clean · OK</summary>

```js
test("converts minutes to seconds", () => {
  expect(toSeconds(3)).toBe(180);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: a real guard. Case file [`checks/verdict/cases/good-unit-seconds/case.mjs`](checks/verdict/cases/good-unit-seconds/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-13"></a>13. <code>formats a receipt line</code> · clean · OK</summary>

```js
test("formats a receipt line", () => {
  expect(formatReceiptLine("Coffee", 2, 3.5)).toBe("Coffee x2 @ 3.50 = 7.00");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: a real guard. Case file [`checks/verdict/cases/good-characterization-receipt/case.mjs`](checks/verdict/cases/good-characterization-receipt/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-14"></a>14. <code>regression #42: a single import resolves</code> · clean · OK</summary>

```js
test("regression #42: a single import resolves", () => {
  expect(parseImports('import a from "b";')).toEqual([{ name: "a", from: "b" }]);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: a clean regression guard. Case file [`checks/verdict/cases/good-regression/case.mjs`](checks/verdict/cases/good-regression/case.mjs), line 2.
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-15"></a>15. <code>regression #77: a trimmed name keeps its inner spaces</code> · clean · OK</summary>

```js
test("regression #77: a trimmed name keeps its inner spaces", () => {
  expect(trimName("  Ada  Lovelace  ")).toBe("Ada  Lovelace");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: a real guard. Case file [`checks/verdict/cases/good-regression-whitespace/case.mjs`](checks/verdict/cases/good-regression-whitespace/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-16"></a>16. <code>reverses a string</code> · clean · OK</summary>

```js
test("reverses a string", () => {
  expect(reverse("abc")).toBe("cba");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` yes. Note: a clean unit guard. Case file [`checks/verdict/cases/good-unit-reverse/case.mjs`](checks/verdict/cases/good-unit-reverse/case.mjs), line 2.
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded · label `deterministic` yes: match.
</details>
<details><summary><a id="case-17"></a>17. <code>slugs a display name</code> · clean · OK</summary>

```js
test("slugs a display name", () => {
  expect(slugify("Hello, World")).toBe("hello-world");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: a real guard. Case file [`checks/verdict/cases/good-unit-slug/case.mjs`](checks/verdict/cases/good-unit-slug/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-18"></a>18. <code>store round trips a value</code> · clean · OK</summary>

```js
test("store round trips a value", async () => {
  const store = await openStore(tmpdir());
  await store.set("k", "v");
  expect(await store.get("k")).toBe("v");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: a clean integration guard. Case file [`checks/verdict/cases/good-integration/case.mjs`](checks/verdict/cases/good-integration/case.mjs), line 2.
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 16 clean · smells: `controlled` (uncontrolled-resource), `restores` (state-leak) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-19"></a>19. <code>the cache returns a stored value</code> · clean · OK</summary>

```js
test("the cache returns a stored value", async () => {
  const cache = await openCache(tmpdir());
  await cache.put("session", "abc123");
  expect(await cache.get("session")).toBe("abc123");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: a real guard. Case file [`checks/verdict/cases/good-integration-cache/case.mjs`](checks/verdict/cases/good-integration-cache/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 17 clean · smells: `restores` (state-leak) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-20"></a>20. <code>the server answers health</code> · clean · OK</summary>

```js
test("the server answers health", async () => {
  const res = await fetch(base + "/health");
  expect(await res.text()).toBe("ok");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: a clean end-to-end guard. Case file [`checks/verdict/cases/good-e2e/case.mjs`](checks/verdict/cases/good-e2e/case.mjs), line 2.
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 16 clean · smells: `controlled` (uncontrolled-resource), `deterministic` (non-deterministic) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-21"></a>21. <code>the service reports its version</code> · clean · OK</summary>

```js
test("the service reports its version", async () => {
  const res = await fetch(base + "/version");
  expect(await res.text()).toBe("2.4.1");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: a real guard. Case file [`checks/verdict/cases/good-e2e-version/case.mjs`](checks/verdict/cases/good-e2e-version/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 16 clean · smells: `controlled` (uncontrolled-resource), `deterministic` (non-deterministic) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-22"></a>22. <code>merges the options</code> · commented-out · OK</summary>

```js
test("merges the options", () => {
  // expect(mergeOptions({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  expect(true).toBe(true);
})
```
- **Known defect:** commented-out. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` no. Note: The real assertion is commented out, beside a tautology. Case file [`checks/asserts/cases/commented-out-merge/case.mjs`](checks/asserts/cases/commented-out-merge/case.mjs), line 2. Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing · `asserts_b` nothing → asserts: nothing. **Escalates:** asserts nothing.
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.00, spread 0.00 (stable). Label no: match. `runs_a` · `runs_b` not recorded → runs: yes.
- **Descriptive:** 13 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-23"></a>23. <code>parses config</code> · commented-out · OK</summary>

```js
test("parses config", () => {
  // expect(parseConfig("a=1")).toEqual({ a: "1" });
  expect(true).toBe(true);
})
```
- **Known defect:** commented-out. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate. Note: commented-out assertion beside a tautology. Case file [`checks/asserts/cases/commented-out/case.mjs`](checks/asserts/cases/commented-out/case.mjs), line 2.
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing · `asserts_b` nothing → asserts: nothing. **Escalates:** asserts nothing.
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.00, spread 0.00 (stable). `runs_a` · `runs_b` not recorded → runs: yes.
- **Descriptive:** 12 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `diagnostic` (silent-failure), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-24"></a>24. <code>creating a user validates, stores and notifies</code> · eager · OK</summary>

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
- **Known defect:** eager. **Check:** [`one-thing`](checks/one-thing/check.mjs). **Expected:** pass, `can_fail` yes. Note: A real user-creation check, but validation, storage and notification are three unrelated behaviours. Case file [`checks/one-thing/cases/unrelated/case.mjs`](checks/one-thing/cases/unrelated/case.mjs), line 2. Sources: [Meszaros, xUnit Test Patterns (Eager Test)](http://xunitpatterns.com/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.99, spread 0.02 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 17 clean · smells: `one_thing` (eager) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-25"></a>25. <code>the pipeline parses, formats and lints</code> · eager · OK</summary>

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
- **Known defect:** eager. **Check:** [`one-thing`](checks/one-thing/check.mjs). **Expected:** pass, `can_fail` yes. Note: A real pipeline check, but parse, format and lint are three features asserted in one body. Case file [`checks/one-thing/cases/three-features/case.mjs`](checks/one-thing/cases/three-features/case.mjs), line 2. Sources: [Meszaros, xUnit Test Patterns (Eager Test)](http://xunitpatterns.com/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 16 clean · smells: `named` (vague-name), `one_thing` (eager) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-26"></a>26. <code>rejects a blank name</code> · early-return · OK</summary>

```js
test("rejects a blank name", () => {
  return;
  expect(validateName("")).toBe(false);
})
```
- **Known defect:** early-return. **Check:** [`conditional`](checks/conditional/check.mjs). **Expected:** escalate, `can_fail` no. Note: The early return makes the assertion unreachable, so the test cannot fail. Case file [`checks/conditional/cases/early-return-name/case.mjs`](checks/conditional/cases/early-return-name/case.mjs), line 2. Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing · `asserts_b` nothing → asserts: nothing. **Escalates:** asserts nothing.
  - `runs_a` · `runs_b` not recorded → runs: no. **Escalates:** does not run.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.01, spread 0.01 (stable). Label no: match. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 15 clean · smells: `conditional` (conditional), `name_matches` (name-mismatch), `diagnostic` (silent-failure) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-27"></a>27. <code>loads the draft</code> · focused · OK</summary>

```js
it("loads the draft", () => {
  expect(loadDraft("draft")).toEqual("draft");
})
```
- **Known defect:** focused. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate. Note: The plain test inherits the file-level focus from it.only. Case file [`checks/runs/cases/focus-draft/case.mjs`](checks/runs/cases/focus-draft/case.mjs), line 6. Extractor notes: `focus-in-file`. Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.84, spread 0.32 (borderline). **Escalates:** can_fail borderline (spread 0.32).
  - `asserts_a` hardcoded-data · `asserts_b` behaviour → asserts: hardcoded-data versus behaviour. **Escalates:** asserts unstable (hardcoded-data vs behaviour).
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` good.
- **Descriptive:** 17 clean · smells: `named` (vague-name) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-28"></a>28. <code>saves the draft</code> · focused · OK</summary>

```js
it.only("saves the draft", () => {
  expect(saveDraft("draft")).toBe(true);
})
```
- **Known defect:** focused. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate. Note: The it.only focuses the file and narrows the whole run. Case file [`checks/runs/cases/focus-draft/case.mjs`](checks/runs/cases/focus-draft/case.mjs), line 2. Extractor notes: `focus-in-file`. Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `runs_a` · `runs_b` not recorded → runs: no. **Escalates:** does not run.
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.97, spread 0.05 (stable). `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-29"></a>29. <code>resolves the status labels</code> · hardcoded-data · OK</summary>

```js
test("resolves the status labels", () => {
  expect(statusLabels()).toEqual(STATUS_LABELS);
})
```
Code under test, [`checks/asserts/cases/status-table/code.mjs`](checks/asserts/cases/status-table/code.mjs):

```js
export const STATUS_LABELS = { open: "Open", blocked: "Blocked", done: "Done" };

export function statusLabels() {
  return STATUS_LABELS;
}
```
- **Known defect:** hardcoded-data. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` no. Note: The expected value is the code under test own constant, so the test agrees by construction and cannot fail. Case file [`checks/asserts/cases/status-table/case.mjs`](checks/asserts/cases/status-table/case.mjs), line 2. Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).
- **What decided it:** good, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.87, spread 0.30 (borderline). **Escalates:** can_fail borderline (spread 0.30). Label no: not scored.
  - `asserts_a` hardcoded-data · `asserts_b` hardcoded-data → asserts: hardcoded-data. **Escalates:** asserts hardcoded-data.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` good.
- **Descriptive:** 17 clean · smells: `named` (vague-name) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-30"></a>30. <code>taxes the standard rate</code> · hardcoded-data · OK</summary>

```js
test("taxes the standard rate", () => {
  expect(taxRates()).toEqual(TAX_RATES);
})
```
Code under test, [`checks/asserts/cases/constant-copy/code.mjs`](checks/asserts/cases/constant-copy/code.mjs):

```js
export const TAX_RATES = { standard: 0.25, reduced: 0.15, food: 0.15, zero: 0 };

export function taxRates() {
  return TAX_RATES;
}
```
- **Known defect:** hardcoded-data. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` no. Note: The expected value is the code under test own constant, so the test agrees by construction and cannot fail. Case file [`checks/asserts/cases/constant-copy/case.mjs`](checks/asserts/cases/constant-copy/case.mjs), line 2. Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).
- **What decided it:** slop, needs eyes.
  - `asserts_a` hardcoded-data · `asserts_b` hardcoded-data → asserts: hardcoded-data. **Escalates:** asserts hardcoded-data.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.12, spread 0.19 (stable). Label no: match. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 16 clean · smells: `name_matches` (name-mismatch), `readable` (obscure) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-31"></a>31. <code>forwards the payload</code> · interaction-only · OK</summary>

```js
test("forwards the payload", () => {
  const spy = mock(send);
  dispatch(message);
  expect(spy.mock.calls[0][0]).toMatchObject({ id: expect.any(String) });
})
```
- **Known defect:** interaction-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes. Note: The mock argument shape can change and fail the test, while the real output stays unchecked. Case file [`checks/asserts/cases/mock-argument/case.mjs`](checks/asserts/cases/mock-argument/case.mjs), line 2. Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.55, spread 0.63 (unstable). **Escalates:** can_fail unstable (spread 0.63). Label yes: not scored.
  - `asserts_a` interaction-only · `asserts_b` interaction-only → asserts: interaction-only. **Escalates:** asserts interaction-only.
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 13 clean · smells: `observable` (implementation-coupled), `specific` (weak-assert), `name_matches` (name-mismatch), `resilient` (structure-dependent), `restores` (state-leak) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-32"></a>32. <code>notifies the listener</code> · interaction-only · OK</summary>

```js
test("notifies the listener", () => {
  const spy = mock(notify);
  publish(event);
  expect(spy).toHaveBeenCalled();
})
```
- **Known defect:** interaction-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes. Note: A missing call fails the test, though the mock stands in for behaviour it never verifies. Case file [`checks/asserts/cases/spy-called/case.mjs`](checks/asserts/cases/spy-called/case.mjs), line 2. Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.76, spread 0.52 (unstable). **Escalates:** can_fail unstable (spread 0.52). Label yes: not scored.
  - `asserts_a` interaction-only · `asserts_b` interaction-only → asserts: interaction-only. **Escalates:** asserts interaction-only.
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 12 clean · smells: `observable` (implementation-coupled), `specific` (weak-assert), `resilient` (structure-dependent), `readable` (obscure), `reads_output` (asserts-input), `restores` (state-leak) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-33"></a>33. <code>publishes twice</code> · interaction-only · OK</summary>

```js
test("publishes twice", () => {
  const spy = mock(publish);
  runBatch(items);
  expect(spy).toHaveBeenCalledTimes(2);
})
```
- **Known defect:** interaction-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes. Note: A changed call count fails the test, yet the payload of each call is never asserted. Case file [`checks/asserts/cases/spy-count/case.mjs`](checks/asserts/cases/spy-count/case.mjs), line 2. Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).
- **What decided it:** weak, needs eyes.
  - `asserts_a` interaction-only · `asserts_b` interaction-only → asserts: interaction-only. **Escalates:** asserts interaction-only.
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.95, spread 0.11 (stable). Label yes: match. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 14 clean · smells: `observable` (implementation-coupled), `resilient` (structure-dependent), `reads_output` (asserts-input), `restores` (state-leak) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-34"></a>34. <code>computes the tax</code> · name-only · OK</summary>

```js
test("computes the tax", () => {
  const tax = computeTax(100);
  expect(tax).toBeDefined();
})
```
- **Known defect:** name-only. **Check:** [`name-matches`](checks/name-matches/check.mjs). **Expected:** escalate, `can_fail` no. Note: name-only: toBeDefined is true for any defined value. Case file [`checks/name-matches/cases/name-only/case.mjs`](checks/name-matches/cases/name-only/case.mjs), line 2.
- **What decided it:** slop, needs eyes.
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.03, spread 0.09 (stable). Label no: match. `runs_a` · `runs_b` not recorded → runs: yes.
- **Descriptive:** 13 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `diagnostic` (silent-failure), `readable` (obscure) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-35"></a>35. <code>computes the tax due</code> · name-only · OK</summary>

```js
test("computes the tax due", () => {
  const tax = computeTax(100);
  expect(tax).toBeDefined();
})
```
- **Known defect:** name-only. **Check:** [`name-matches`](checks/name-matches/check.mjs). **Expected:** escalate, `can_fail` no. Note: The name promises a tax value, while toBeDefined is true for any defined value. Case file [`checks/name-matches/cases/tax-defined/case.mjs`](checks/name-matches/cases/tax-defined/case.mjs), line 2. Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.01, spread 0.03 (stable). Label no: match. `runs_a` · `runs_b` not recorded → runs: yes.
- **Descriptive:** 13 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `diagnostic` (silent-failure), `readable` (obscure) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-36"></a>36. <code>sorts rows by name</code> · name-only · OK</summary>

```js
test("sorts rows by name", () => {
  const rows = sortRows([{ name: "b" }, { name: "a" }]);
  expect(rows).toHaveLength(2);
})
```
- **Known defect:** name-only. **Check:** [`name-matches`](checks/name-matches/check.mjs). **Expected:** escalate, `can_fail` no. Note: The name promises a sort, while the length check holds for any permutation. Case file [`checks/name-matches/cases/sort-length/case.mjs`](checks/name-matches/cases/sort-length/case.mjs), line 2. Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.18, spread 0.53 (unstable). **Escalates:** can_fail unstable (spread 0.53). Label no: not scored.
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 16 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-37"></a>37. <code>validates email addresses</code> · name-only · OK</summary>

```js
test("validates email addresses", () => {
  expect(isValidEmail("a@b.com")).toBeTruthy();
})
```
- **Known defect:** name-only. **Check:** [`name-matches`](checks/name-matches/check.mjs). **Expected:** escalate, `can_fail` no. Note: The name promises validation, while a truthy check passes for any non-empty value. Case file [`checks/name-matches/cases/email-truthy/case.mjs`](checks/name-matches/cases/email-truthy/case.mjs), line 2. Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.69, spread 0.80 (unstable). **Escalates:** can_fail unstable (spread 0.80). Label no: not scored.
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 15 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-38"></a>38. <code>debounce fires once</code> · non-deterministic · OK</summary>

```js
test("debounce fires once", async () => {
  const calls = [];
  const debounced = debounce(() => calls.push(1), 20);
  debounced();
  await sleep(50);
  expect(calls.length).toBe(1);
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** escalate or pass, `can_fail` yes, `deterministic` no. Note: a real guard, but timer-bound; reported, not escalated. Case file [`checks/deterministic/cases/flaky/case.mjs`](checks/deterministic/cases/flaky/case.mjs), line 2.
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.99, spread 0.02 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` good.
- **Descriptive:** 14 clean · smells: `controlled` (uncontrolled-resource), `deterministic` (non-deterministic), `fast` (slow), `magic_number` (magic-number) · unanswered: none · `type` not recorded · label `deterministic` no: match.
</details>
<details><summary><a id="case-39"></a>39. <code>the metric keys keep their insertion order</code> · non-deterministic · OK</summary>

```js
test("the metric keys keep their insertion order", () => {
  const metrics = collectMetrics({ z: 1, a: 2 });
  expect(Object.keys(metrics)).toEqual(["z", "a"]);
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no. Note: A real metrics check, but it pins key order that the structure does not guarantee. Case file [`checks/deterministic/cases/order/case.mjs`](checks/deterministic/cases/order/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata (deterministic)](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.99, spread 0.01 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded · **label `deterministic` no, tool yes**.
</details>
<details><summary><a id="case-40"></a>40. <code>finds no imports in an empty file</code> · only-negative · OK</summary>

```js
test("finds no imports in an empty file", () => {
  expect(findImports("")).toEqual([]);
})
```
- **Known defect:** only-negative. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate, `can_fail` yes. Note: Only the empty result is checked, so a finder that never finds anything would pass. Case file [`checks/positive/cases/empty-array/case.mjs`](checks/positive/cases/empty-array/case.mjs), line 2. Sources: [verify-prd-implemented test-patterns (Passes for the wrong reason; No negative/positive pair)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** strong, needs eyes.
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `verdict` strong.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-41"></a>41. <code>no edge for a comment</code> · only-negative · OK</summary>

```js
test("no edge for a comment", () => {
  expect(resolveEdges("// comment")).toBeNull();
})
```
- **Known defect:** only-negative. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate, `can_fail` yes. Note: no positive/negative pair. Case file [`checks/positive/cases/only-negative/case.mjs`](checks/positive/cases/only-negative/case.mjs), line 2.
- **What decided it:** strong, needs eyes.
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.98, spread 0.04 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `verdict` strong.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-42"></a>42. <code>parses a well formed header</code> · only-negative · OK</summary>

```js
test("parses a well formed header", () => {
  const run = () => parseHeader("content-length: 12");
  expect(run).not.toThrow();
})
```
- **Known defect:** only-negative. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate, `can_fail` yes. Note: Only that the call does not throw is checked, and the parsed output is never asserted. Case file [`checks/positive/cases/no-throw/case.mjs`](checks/positive/cases/no-throw/case.mjs), line 2. Sources: [verify-prd-implemented test-patterns (Passes for the wrong reason; No negative/positive pair)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.25, spread 0.70 (unstable). **Escalates:** can_fail unstable (spread 0.70). Label yes: not scored.
  - `asserts_a` nothing · `asserts_b` nothing → asserts: nothing. **Escalates:** asserts nothing.
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes.
- **Descriptive:** 15 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `reads_output` (asserts-input) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-43"></a>43. <code>returns null for an unknown setting</code> · only-negative · OK</summary>

```js
test("returns null for an unknown setting", () => {
  expect(readSetting({ theme: "dark" }, "font")).toBeNull();
})
```
- **Known defect:** only-negative. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate, `can_fail` yes. Note: Only the absent lookup is checked, so a reader that always returns null would pass. Case file [`checks/positive/cases/absent-key/case.mjs`](checks/positive/cases/absent-key/case.mjs), line 2. Sources: [verify-prd-implemented test-patterns (Passes for the wrong reason; No negative/positive pair)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** strong, needs eyes.
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.01 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `verdict` strong.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-44"></a>44. <code>events are dispatched</code> · passes-with-zero · OK</summary>

```js
test("events are dispatched", () => {
  const dispatched = collect();
  expect(dispatched).toBeDefined();
})
```
- **Known defect:** passes-with-zero. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: The check only asks whether the collection is defined, so no dispatch passes. Case file [`checks/can-fail/cases/empty-dispatch/case.mjs`](checks/can-fail/cases/empty-dispatch/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing · `asserts_b` shape-only → asserts: nothing versus shape-only. **Escalates:** asserts unstable (nothing vs shape-only).
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.01, spread 0.01 (stable). Label no: match. `runs_a` · `runs_b` not recorded → runs: yes.
- **Descriptive:** 12 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `diagnostic` (silent-failure), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-45"></a>45. <code>imports are folded</code> · passes-with-zero · OK</summary>

```js
test("imports are folded", () => {
  const commit = buildCommit([]);
  expect(commit.imports).toBeDefined();
})
```
- **Known defect:** passes-with-zero. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: vacuous: passes when the feature produces nothing. Case file [`checks/can-fail/cases/vacuous-zero/case.mjs`](checks/can-fail/cases/vacuous-zero/case.mjs), line 2.
- **What decided it:** slop, needs eyes.
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.02, spread 0.07 (stable). Label no: match. `runs_a` · `runs_b` not recorded → runs: yes.
- **Descriptive:** 14 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `diagnostic` (silent-failure), `readable` (obscure) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-46"></a>46. <code>parse is stable</code> · self-reference · OK</summary>

```js
test("parse is stable", () => {
  expect(parse(src)).toEqual(parse(src));
})
```
- **Known defect:** self-reference. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: Both sides call the same production function, so the comparison is true by construction. Case file [`checks/can-fail/cases/self-parse/case.mjs`](checks/can-fail/cases/self-parse/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing · `asserts_b` nothing → asserts: nothing. **Escalates:** asserts nothing.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.00, spread 0.01 (stable). Label no: match. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 14 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `readable` (obscure) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-47"></a>47. <code>reader round trips</code> · self-reference · OK</summary>

```js
test("reader round trips", () => {
  expect(parse(source)).toEqual(parse(source));
})
```
- **Known defect:** self-reference. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: tautology: both sides call the same production code. Case file [`checks/can-fail/cases/tautology-selfreference/case.mjs`](checks/can-fail/cases/tautology-selfreference/case.mjs), line 2.
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing · `asserts_b` nothing → asserts: nothing. **Escalates:** asserts nothing.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.00, spread 0.01 (stable). Label no: match. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 12 clean · smells: `controlled` (uncontrolled-resource), `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-48"></a>48. <code>the two totals match</code> · self-reference · OK</summary>

```js
test("the two totals match", () => {
  expect(total(rows)).toBe(total(rows));
})
```
- **Known defect:** self-reference. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: One helper backs both sides, so any change to it moves both sides together. Case file [`checks/can-fail/cases/helper-agreement/case.mjs`](checks/can-fail/cases/helper-agreement/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing · `asserts_b` nothing → asserts: nothing. **Escalates:** asserts nothing.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.00, spread 0.00 (stable). Label no: match. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 14 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `readable` (obscure), `magic_number` (magic-number) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-49"></a>49. <code>builds three steps</code> · shape-only · OK</summary>

```js
test("builds three steps", () => {
  const steps = planSteps(task);
  expect(steps.length).toBe(3);
})
```
- **Known defect:** shape-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes. Note: A wrong count fails the test, yet the step contents are never checked. Case file [`checks/asserts/cases/result-length/case.mjs`](checks/asserts/cases/result-length/case.mjs), line 2. Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).
- **What decided it:** weak, needs eyes.
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.88, spread 0.22 (stable). Label yes: match. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 16 clean · smells: `specific` (weak-assert), `magic_number` (magic-number) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-50"></a>50. <code>loads the profile fields</code> · shape-only · OK</summary>

```js
test("loads the profile fields", () => {
  const profile = loadProfile(id);
  expect(Object.keys(profile)).toEqual(["name", "email", "age"]);
})
```
- **Known defect:** shape-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes. Note: The keys can change and fail the test, but the field values pass unexamined. Case file [`checks/asserts/cases/result-keys/case.mjs`](checks/asserts/cases/result-keys/case.mjs), line 2. Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).
- **What decided it:** good, needs eyes.
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.97, spread 0.07 (stable). Label yes: match. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` good.
- **Descriptive:** 16 clean · smells: `controlled` (uncontrolled-resource), `named` (vague-name) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-51"></a>51. <code>planner returns roads</code> · shape-only · OK</summary>

```js
test("planner returns roads", () => {
  const roads = plan();
  expect(Array.isArray(roads)).toBe(true);
  expect(roads.length).toBe(3);
})
```
- **Known defect:** shape-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes. Note: shape-not-value: a shape change can fail it, the content is never checked. Case file [`checks/asserts/cases/shape-not-value/case.mjs`](checks/asserts/cases/shape-not-value/case.mjs), line 2.
- **What decided it:** weak, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.63, spread 0.85 (unstable). **Escalates:** can_fail unstable (spread 0.85). Label yes: not scored.
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - `verdict` weak. **Escalates:** verdict weak.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 13 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `readable` (obscure), `magic_number` (magic-number) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-52"></a>52. <code>returns a list of routes</code> · shape-only · OK</summary>

```js
test("returns a list of routes", () => {
  const routes = routesFor(graph);
  expect(Array.isArray(routes)).toBe(true);
})
```
- **Known defect:** shape-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes. Note: The array check can fail when the return type changes, but no route value is ever asserted. Case file [`checks/asserts/cases/result-array/case.mjs`](checks/asserts/cases/result-array/case.mjs), line 2. Sources: [testsmells.org, Open Catalog of Test Smells](https://testsmells.org/).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.27, spread 0.80 (unstable). **Escalates:** can_fail unstable (spread 0.80). Label yes: not scored.
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 16 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-53"></a>53. <code>handles overflow</code> · skipped · OK</summary>

```js
test.skip("handles overflow", () => {
  expect(add(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER + 1);
})
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate. Note: skipped: the test never runs. Case file [`checks/runs/cases/skipped/case.mjs`](checks/runs/cases/skipped/case.mjs), line 2.
- **What decided it:** slop, needs eyes.
  - `runs_a` · `runs_b` not recorded → runs: no. **Escalates:** does not run.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.10, spread 0.16 (stable). `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 17 clean · smells: `named` (vague-name) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-54"></a>54. <code>parses a dotted key</code> · skipped · OK</summary>

```js
xit("parses a dotted key", () => {
  expect(parseKey("a.b")).toEqual(["a", "b"]);
})
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate. Note: The test is marked xit, so it never runs. Case file [`checks/runs/cases/xit-key/case.mjs`](checks/runs/cases/xit-key/case.mjs), line 2. Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.39, spread 0.51 (unstable). **Escalates:** can_fail unstable (spread 0.51).
  - `runs_a` · `runs_b` not recorded → runs: no. **Escalates:** does not run.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-55"></a>55. <code>rejects a stale token</code> · skipped · OK</summary>

```js
test.skip("rejects a stale token", () => {
  expect(verifyToken("expired")).toBe(false);
})
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate. Note: The test is marked skipped, so it never runs. Case file [`checks/runs/cases/skip-token/case.mjs`](checks/runs/cases/skip-token/case.mjs), line 2. Sources: [Meszaros, xUnit Test Patterns (Obscure Test)](http://xunitpatterns.com/); [verify-prd-implemented test-patterns (Skipped / disabled / focused)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing · `asserts_b` behaviour → asserts: nothing versus behaviour. **Escalates:** asserts unstable (nothing vs behaviour).
  - `runs_a` · `runs_b` not recorded → runs: no. **Escalates:** does not run.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.04, spread 0.08 (stable). `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-56"></a>56. <code>the build is green</code> · tautology · OK</summary>

```js
test("the build is green", () => {
  expect(true).toBe(true);
})
```
- **Known defect:** tautology. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: The assertion holds for every build, so breaking the code cannot fail it. Case file [`checks/can-fail/cases/constant-truth/case.mjs`](checks/can-fail/cases/constant-truth/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing · `asserts_b` nothing → asserts: nothing. **Escalates:** asserts nothing.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.00, spread 0.00 (stable). Label no: match. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 14 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `reads_output` (asserts-input) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-57"></a>57. <code>the world is sane</code> · tautology · OK</summary>

```js
test("the world is sane", () => {
  expect(true).toBe(true);
})
```
- **Known defect:** tautology. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: tautology: true === true. Case file [`checks/can-fail/cases/tautology-constant/case.mjs`](checks/can-fail/cases/tautology-constant/case.mjs), line 2.
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing · `asserts_b` nothing → asserts: nothing. **Escalates:** asserts nothing.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.00, spread 0.00 (stable). Label no: match. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 13 clean · smells: `observable` (implementation-coupled), `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `reads_output` (asserts-input) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-58"></a>58. <code>the queue is not negative</code> · vacuous · OK</summary>

```js
test("the queue is not negative", () => {
  expect(queue.length).toBeGreaterThanOrEqual(0);
})
```
- **Known defect:** vacuous. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: A length is never negative, so the bound is always true. Case file [`checks/can-fail/cases/count-nonnegative/case.mjs`](checks/can-fail/cases/count-nonnegative/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** slop, needs eyes.
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.03, spread 0.02 (stable). Label no: match. `runs_a` · `runs_b` not recorded → runs: yes.
- **Descriptive:** 16 clean · smells: `specific` (weak-assert), `readable` (obscure) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-59"></a>59. <code>the summary is produced</code> · vacuous · OK</summary>

```js
test("the summary is produced", () => {
  const summary = summarise(rows);
  expect(summary.totals).toBeDefined();
})
```
- **Known defect:** vacuous. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: The aggregate exists, but no value inside it is ever read. Case file [`checks/can-fail/cases/aggregate-exists/case.mjs`](checks/can-fail/cases/aggregate-exists/case.mjs), line 2. Sources: [Kent Beck, Test Desiderata](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.16, spread 0.44 (borderline). **Escalates:** can_fail borderline (spread 0.44). Label no: not scored.
  - `asserts_a` shape-only · `asserts_b` shape-only → asserts: shape-only. **Escalates:** asserts shape-only.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 14 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `readable` (obscure) · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-60"></a>60. <code>builds a job with the given name</code> · wrong-reason · OK</summary>

```js
test("builds a job with the given name", () => {
  const job = buildJob({ name: "nightly", steps: [] });
  expect(job.name).toBe("nightly");
})
```
Code under test, [`checks/reads-output/cases/passthrough-argument/code.mjs`](checks/reads-output/cases/passthrough-argument/code.mjs):

```js
export function buildJob({ name, steps }) {
  return { name, steps, status: "queued", createdAt: Date.now() };
}
```
- **Known defect:** wrong-reason. **Check:** [`reads-output`](checks/reads-output/check.mjs). **Expected:** escalate or pass, `can_fail` yes. Note: The asserted field is copied from the argument, so a stub that only copies would pass. Only the mutation check proves this, so escalation is welcome but not required. Case file [`checks/reads-output/cases/passthrough-argument/case.mjs`](checks/reads-output/cases/passthrough-argument/case.mjs), line 2. Sources: [verify-prd-implemented test-patterns (Passes for the wrong reason; No negative/positive pair)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 1.00, spread 0.01 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded. `verdict` strong.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-61"></a>61. <code>reports no booking for a free slot</code> · wrong-reason · OK</summary>

```js
test("reports no booking for a free slot", () => {
  const calendar = new Calendar();
  expect(calendar.bookingAt("2026-11-01T09:00")).toBeNull();
})
```
Code under test, [`checks/positive/cases/absent-record/code.mjs`](checks/positive/cases/absent-record/code.mjs):

```js
export class Calendar {
  #bookings = new Map();

  book(slot, who) {
    if (this.#bookings.has(slot)) throw new Error(`${slot} is taken`);
    this.#bookings.set(slot, { slot, who });
  }

  bookingAt(slot) {
    return this.#bookings.get(slot) ?? null;
  }
}
```
- **Known defect:** wrong-reason. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate or pass, `can_fail` yes. Note: The lookup is empty only because the fixture never creates the booking it queries. Only the mutation check proves this, so escalation is welcome but not required. Case file [`checks/positive/cases/absent-record/case.mjs`](checks/positive/cases/absent-record/case.mjs), line 2. Sources: [verify-prd-implemented test-patterns (Passes for the wrong reason; No negative/positive pair)](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, needs eyes.
  - `positive_a` · `positive_b` not recorded → positive: not recorded. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.97, spread 0.06 (stable). Label yes: match. `asserts_a` behaviour · `asserts_b` behaviour → asserts: behaviour. `runs_a` · `runs_b` not recorded → runs: yes. `verdict` good.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` not recorded.
</details>
<details><summary><a id="case-62"></a>62. <code>saves the user</code> · wrong-reason · OK</summary>

```js
test("saves the user", () => {
  const spy = mock(saveUser);
  save(user);
  expect(spy).toHaveBeenCalled();
})
```
Code under test, [`checks/asserts/cases/wrong-reason-mock/code.mjs`](checks/asserts/cases/wrong-reason-mock/code.mjs):

```js
import { saveUser } from "./store.mjs";

export function save(user) {
  if (!user.email) throw new Error("a user needs an email");
  return saveUser({ ...user, email: user.email.toLowerCase() });
}
```
- **Known defect:** wrong-reason. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes. Note: passes for the wrong reason: only the mock call is checked. Case file [`checks/asserts/cases/wrong-reason-mock/case.mjs`](checks/asserts/cases/wrong-reason-mock/case.mjs), line 2.
- **What decided it:** slop, needs eyes.
  - `can_fail_a` · `can_fail_b` · `can_fail_c` not recorded → can_fail: 0.47, spread 0.59 (unstable). **Escalates:** can_fail unstable (spread 0.59). Label yes: not scored.
  - `asserts_a` interaction-only · `asserts_b` interaction-only → asserts: interaction-only. **Escalates:** asserts interaction-only.
  - `verdict` slop. **Escalates:** verdict slop.
  - No escalation: `runs_a` · `runs_b` not recorded → runs: yes. `positive_a` · `positive_b` not recorded → positive: not recorded.
- **Descriptive:** 10 clean · smells: `observable` (implementation-coupled), `specific` (weak-assert), `name_matches` (name-mismatch), `resilient` (structure-dependent), `diagnostic` (silent-failure), `readable` (obscure), `reads_output` (asserts-input), `restores` (state-leak) · unanswered: none · `type` not recorded.
</details>

## Legend

- **Case**: one labelled test in `checks/<check>/cases/<case>/`. `case.mjs` holds the test, `label.json` states the known defect and the expected outcome, and `code.mjs`, if the case has one, holds the code under test.
- **Check**: the check that the case is meant to catch, in `checks/<check>/check.mjs`. A clean case and a mixed case belong to the `verdict` check.
- **Escalate**: the tool sends the test to a human, so the test **needs eyes**. Each reason says why. A test with no reason **passes**.
- **can_fail**: the probability that a change to the code under test can make the test fail. The tool asks it in 3 phrasings and takes the mean. The **spread** is the highest value minus the lowest. A spread above `TEST_AUDIT_STABLE_BAND` makes the value borderline or unstable, and the test escalates.
- **Twin pair**: `runs` (`runs_a`, `runs_b`) and `positive` (`positive_a`, `positive_b`). The tool asks each twice. The value counts only when both phrasings agree. A "no" escalates.
- **Negated phrasing**: `can_fail_b`, `positive_b`, `runs_b` ask the opposite, so their "no" is the good answer.
- **asserts**: what the assertion checks. Only `behaviour` is a real guard. `asserts_a` and `asserts_b` list the options in opposite order, and must agree.
- **verdict**: a score from 0 (slop) to 3 (strong). A verdict of weak or lower escalates.
- **Descriptive question**: a "no" is a **smell**. It raises the flag in brackets. It does not escalate the test.
- **Number in brackets**: for a yes/no question, the probability of yes. For a choice, the probability of the chosen option. For the verdict, the score.
- **not recorded**: the run did not record the value. **unanswered**: the endpoint gave no answer. **untrusted**: the answer has a `mass` below `TEST_AUDIT_MIN_MASS`. **not scored**: the tool did not commit to a can_fail value, so the agreement does not count the case.
- **Status** of a case:
  - **OK**: the outcome matches the label.
  - **SILENT pass**: a defect case did not escalate. Acceptance fails.
  - **MIXED not routed**: a mixed case did not escalate. Acceptance fails.
  - **FALSE positive**: a case that should pass escalated.
  - **WRONG can_fail**: the tool committed to the wrong can_fail value.
  - **NO ANSWER**: the endpoint gave no trusted answer. Acceptance fails.
  - **NO TEST**: the case file holds no test with this name. Acceptance fails.

### Questions

The tool asks each test these questions in one call.

| Question | Asks | Answer |
| --- | --- | --- |
| `can_fail_a` | Could you make this test fail by changing only the code under test? | yes: a change to the code under test can make it fail |
| `can_fail_b` | Does this test pass regardless of whether the code under test is correct? | yes: it passes even when the behaviour is broken |
| `can_fail_c` | If the behaviour this test exercises regresses, will the test fail? | yes: the assertion can catch a regression in the behaviour |
| `asserts_a` | What does this test actually assert about the code under test? | one of: behaviour, hardcoded-data, shape-only, interaction-only, nothing |
| `asserts_b` | What does the test's assertion actually check? | one of: nothing, interaction-only, shape-only, hardcoded-data, behaviour |
| `positive_a` | Does this test assert at least one output that the code under test must produce? | yes: it asserts an output that must be present |
| `positive_b` | Do all the assertions in this test check only that something is absent, empty, or did not throw? | yes: it asserts only an absence, an empty result, or a non-throw |
| `runs_a` | Is this test free of markers that change whether it runs? Check the test, each describe around it, and the other tests in the file. | yes: no skip, todo, only, or focus marker affects it |
| `runs_b` | Is there a skip, todo, only, or focus marker on this test or on a describe around it, or an only or focus marker on another test in the file? | yes: a marker changes whether it runs |
| `type` | What type of test is this? | one of: unit, integration, regression, e2e, smoke, characterization |
| `observable` | Does this test assert observable behaviour of the code under test, rather than private internals or internal call order? | yes: it checks behaviour a caller could observe |
| `conditional` | Does this test assert unconditionally, with no branch, loop, or catch that can leave the assertion unrun? | yes: the assertion always runs |
| `isolated` | Does this test pass on its own and in any order, with no reliance on shared mutable state or another test? | yes: it is independent of other tests and of run order |
| `controlled` | Does the test control the external resources it needs, such as time, the network, the filesystem, or the environment, rather than assume they are present? | yes: its inputs and resources are controlled |
| `specific` | Does the test use the most specific assertion that would catch the failure, rather than a weaker one that would also pass on wrong output? | yes: the assertion is specific to the expected value |
| `named` | Does the test's name state the behaviour and its expected result, rather than a vague label such as works, test1, or should be fine? | yes: the name states the behaviour and the expected result |
| `deterministic` | Does this test give the same result on every run, with no reliance on time, order, the network, or a sleep? | yes: it gives the same result every run |
| `one_thing` | Does this test check one behaviour, rather than several unrelated behaviours at once? | yes: it checks one behaviour |
| `name_matches` | Does the test body assert the behaviour its name states? | yes: the body asserts the behaviour the name promises |
| `resilient` | Would this test stay green through a refactor of the code under test that keeps the same behaviour? | yes: the test checks behaviour, so a behaviour-preserving refactor keeps it green |
| `diagnostic` | When this test fails, does it say which assertion failed and what was expected? | yes: the failure names the assertion and the expected value |
| `fixture` | Does the test build only the data it needs, rather than a large shared fixture or values unrelated to the behaviour? | yes: it builds only the data it needs |
| `fast` | Does the test run fast, with no sleep, no heavy I/O, and no large computation? | yes: it runs fast |
| `readable` | Can a reader tell what this test does and why, without opening the code under test? | yes: the test reads clearly on its own |
| `magic_number` | Does the assertion name its values, rather than use a bare number or string the reader must decode? | yes: the values are named or self-explanatory |
| `reads_output` | Does the assertion read the value the code under test produced, rather than its own input, its setup, or only that no error was thrown? | yes: it asserts the returned or observed output |
| `automated` | Does this test reach a pass or fail with no person doing or reading anything? | yes: it is self-checking and unattended |
| `restores` | Does the test restore every global, environment variable, timer, and spy that it changes, so it leaves nothing for the next test? | yes: it clears or restores what it changes |
| `verdict` | Overall, is this test a real guard against the behaviour it names? Weigh whether it can fail, what it asserts, and every smell the earlier questions name. It is a real guard only if it can fail when that behaviour breaks. | scale: slop, weak, good, strong |
