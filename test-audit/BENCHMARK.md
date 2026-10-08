# test-audit benchmark

Date: 2026-10-08. Command:

```sh
TEST_AUDIT_CONCURRENCY=4 TEST_AUDIT_TIMEOUT_MS=900000 node cli.mjs --selftest --benchmark \
  --targets "http://koishi.tail6defbc.ts.net:8090|qwen3.8-flash-next-mtp"
```

> The run took 46m56s on Koishi. The battery is 15 yes/no questions in Simplified Technical English. An asserts answer near 0.5 escalates only when it changes the kind. On TapScribe's 98 most recently changed pytest tests the same battery gives 0 drop, 23 fix, 20 look, and 55 ok.

This file records a calibration run of `test-audit` over the labelled corpus. Each case is one test with a known defect, or a clean test. The [legend](#legend) explains the terms.

## Summary: qwen3.8-flash-next-mtp

Endpoint `http://koishi.tail6defbc.ts.net:8090`, model `qwen3.8-flash-next-mtp`. 107 cases, 107 calls, 26504 tokens.

| Measure | Result | Meaning |
| --- | --- | --- |
| Cases | 107 | The labelled tests in the corpus. |
| Silent passes | 0 | Defect cases that did not escalate. Must be 0. |
| False positives | 2 of 58 | Cases that should pass, but escalated. Lower is better. |
| Sure false positives | 0 of 2 | False positives whose finding says it is sure, so the reader acts on a sound test. Lower is better. |
| can_fail agreement | 82 of 87 (94%) | The can_fail answers that match the label. Only the cases where the tool committed to a value count. Must be 90% or more. |
| Mixed routed | 5 of 5 | Mixed cases that escalated. Must be all. |
| Check agreement | 111 of 116 | The check values that match the label, where the label names one and the tool committed. Not an acceptance rule. The table below splits it by check. |
| Unresolved | 0 | Cases with no test or no answer. Must be 0. |
| Acceptance | **PASS** | PASS when each "must" in this table holds. |

### Defect families

| Family | Cases | Escalated | Expected | OK |
| --- | --- | --- | --- | --- |
| ambiguous | 5 | 5 | escalate | yes |
| clean | 37 | 0 | pass | yes |
| commented-out | 2 | 2 | escalate | **no**: 2 WRONG check |
| conditional-logic | 1 | 0 | pass | yes |
| eager | 2 | 1 | pass | **no**: 1 FALSE positive |
| early-return | 1 | 1 | escalate | yes |
| focused | 2 | 2 | escalate | yes |
| from-code | 2 | 2 | escalate | **no**: 2 WRONG can_fail |
| general-fixture | 1 | 0 | pass | yes |
| implementation-coupled | 1 | 0 | either | yes |
| interaction-only | 3 | 3 | escalate | yes |
| magic-number | 1 | 0 | pass | yes |
| manual | 1 | 0 | pass | yes |
| name-only | 4 | 3 | 1 either, 3 escalate | yes |
| non-deterministic | 6 | 1 | 5 pass, 1 either | **no**: 1 FALSE positive |
| obscure | 1 | 0 | pass | yes |
| only-negative | 4 | 4 | escalate | yes |
| order-dependent | 1 | 0 | pass | **no**: 1 WRONG check |
| passes-with-zero | 2 | 2 | escalate | yes |
| self-reference | 3 | 3 | escalate | **no**: 1 WRONG can_fail |
| shape-only | 4 | 4 | escalate | yes |
| silent-failure | 1 | 0 | pass | yes |
| skipped | 5 | 5 | escalate | yes |
| slow | 1 | 0 | pass | yes |
| smoke | 1 | 1 | escalate | yes |
| state-leak | 3 | 0 | pass | **no**: 1 WRONG check |
| structure-dependent | 1 | 0 | pass | yes |
| tautology | 2 | 2 | escalate | yes |
| uncontrolled-resource | 1 | 0 | pass | yes |
| vacuous | 2 | 2 | escalate | **no**: 1 WRONG can_fail |
| vague-name | 1 | 0 | pass | yes |
| weak-assert | 1 | 1 | either | yes |
| wrong-reason | 4 | 3 | 2 escalate, 2 either | **no**: 1 WRONG can_fail |

### Check agreement

| Check | Labelled | Committed | Match |
| --- | --- | --- | --- |
| `asserts` | 28 | 25 | 22 (88%) |
| `positive` | 19 | 19 | 19 (100%) |
| `runs` | 20 | 20 | 20 (100%) |
| `conditional` | 3 | 3 | 3 (100%) |
| `isolated` | 3 | 3 | 2 (67%) |
| `deterministic` | 17 | 17 | 17 (100%) |
| `automated` | 2 | 2 | 2 (100%) |
| `restores` | 5 | 5 | 4 (80%) |
| `resilient` | 11 | 11 | 11 (100%) |
| `verdict` | 13 | 11 | 11 (100%) |

**Not OK:** [1. `merges the options`](#case-1) WRONG check · [2. `parses config`](#case-2) WRONG check · [3. `the pipeline parses, formats and lints`](#case-3) FALSE positive · [4. `resolves the status labels`](#case-4) WRONG can_fail · [5. `taxes the standard rate`](#case-5) WRONG can_fail · [6. `the token has not expired yet`](#case-6) FALSE positive · [7. `dispatches to the registered handler`](#case-7) WRONG check · [8. `parse is stable`](#case-8) WRONG can_fail · [9. `registers a handler`](#case-9) WRONG check · [10. `the queue is not negative`](#case-10) WRONG can_fail · [11. `normalise trims the title`](#case-11) WRONG can_fail.

## Cases at a glance: qwen3.8-flash-next-mtp

The cases that are not OK come first, then the others by defect family. A test name links to its details.

| # | Test | Check | Known defect | Expected | Result | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [`merges the options`](#case-1) | [`asserts`](checks/asserts/check.mjs) | commented-out | escalate | slop, needs eyes | **WRONG check** |
| 2 | [`parses config`](#case-2) | [`asserts`](checks/asserts/check.mjs) | commented-out | escalate | slop, needs eyes | **WRONG check** |
| 3 | [`the pipeline parses, formats and lints`](#case-3) | [`verdict`](checks/verdict/check.mjs) | eager | pass | good, needs eyes | **FALSE positive** |
| 4 | [`resolves the status labels`](#case-4) | [`asserts`](checks/asserts/check.mjs) | from-code | escalate | slop, needs eyes | **WRONG can_fail** |
| 5 | [`taxes the standard rate`](#case-5) | [`asserts`](checks/asserts/check.mjs) | from-code | escalate | slop, needs eyes | **WRONG can_fail** |
| 6 | [`the token has not expired yet`](#case-6) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | unclassified, needs eyes | **FALSE positive** |
| 7 | [`dispatches to the registered handler`](#case-7) | [`isolated`](checks/isolated/check.mjs) | order-dependent | pass | good, passes | **WRONG check** |
| 8 | [`parse is stable`](#case-8) | [`can-fail`](checks/can-fail/check.mjs) | self-reference | escalate | slop, needs eyes | **WRONG can_fail** |
| 9 | [`registers a handler`](#case-9) | [`isolated`](checks/isolated/check.mjs) | state-leak | pass | good, passes | **WRONG check** |
| 10 | [`the queue is not negative`](#case-10) | [`can-fail`](checks/can-fail/check.mjs) | vacuous | escalate | weak, needs eyes | **WRONG can_fail** |
| 11 | [`normalise trims the title`](#case-11) | [`verdict`](checks/verdict/check.mjs) | wrong-reason | escalate | good, needs eyes | **WRONG can_fail** |
| 12 | [`builds the graph`](#case-12) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate | weak, needs eyes | OK |
| 13 | [`collects the graph nodes`](#case-13) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate | weak, needs eyes | OK |
| 14 | [`retries once`](#case-14) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate | unclassified, needs eyes | OK |
| 15 | [`the schema is sound`](#case-15) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate | unclassified, needs eyes | OK |
| 16 | [`the world is sane`](#case-16) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate | unclassified, needs eyes | OK |
| 17 | [`a new job starts queued with no steps`](#case-17) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 18 | [`a seeded shuffle gives a fixed order`](#case-18) | [`deterministic`](checks/deterministic/check.mjs) | clean | pass | good, passes | OK |
| 19 | [`a token expires after its time to live`](#case-19) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 20 | [`add handles negatives`](#case-20) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 21 | [`adds two numbers`](#case-21) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 22 | [`an invoice falls due thirty days after it is issued`](#case-22) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 23 | [`capitalises a lower case name`](#case-23) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 24 | [`capitalises the first letter`](#case-24) | [`conditional`](checks/conditional/check.mjs) | clean | pass | good, passes | OK |
| 25 | [`converts minutes to seconds`](#case-25) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 26 | [`counts the words in a sentence`](#case-26) | [`isolated`](checks/isolated/check.mjs) | clean | pass | good, passes | OK |
| 27 | [`debounce fires once after the wait`](#case-27) | [`deterministic`](checks/deterministic/check.mjs) | clean | pass | good, passes | OK |
| 28 | [`finds the imports of a file`](#case-28) | [`positive`](checks/positive/check.mjs) | clean | pass | good, passes | OK |
| 29 | [`formats a date as ISO`](#case-29) | [`automated`](checks/automated/check.mjs) | clean | pass | good, passes | OK |
| 30 | [`formats a receipt line`](#case-30) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 31 | [`joins two path parts with a slash`](#case-31) | [`resilient`](checks/resilient/check.mjs) | clean | pass | good, passes | OK |
| 32 | [`orders the scores from low to high`](#case-32) | [`asserts`](checks/asserts/check.mjs) | clean | pass | good, passes | OK |
| 33 | [`parses a number`](#case-33) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 34 | [`parses a semantic version`](#case-34) | [`asserts`](checks/asserts/check.mjs) | clean | pass | good, passes | OK |
| 35 | [`parses a well formed header`](#case-35) | [`runs`](checks/runs/check.mjs) | clean | pass | good, passes | OK |
| 36 | [`pins the current receipt layout before the rewrite`](#case-36) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 37 | [`reads the port from the environment`](#case-37) | [`restores`](checks/restores/check.mjs) | clean | pass | good, passes | OK |
| 38 | [`regression #12: an empty list sums to zero`](#case-38) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 39 | [`regression #42: a single import resolves`](#case-39) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 40 | [`regression #77: a trimmed name keeps its inner spaces`](#case-40) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 41 | [`rejects a header without a colon`](#case-41) | [`positive`](checks/positive/check.mjs) | clean | pass | good, passes | OK |
| 42 | [`removes duplicate tags`](#case-42) | [`resilient`](checks/resilient/check.mjs) | clean | pass | good, passes | OK |
| 43 | [`reverses a string`](#case-43) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 44 | [`rounds to two decimals`](#case-44) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 45 | [`slugs a display name`](#case-45) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 46 | [`splits a version into its parts`](#case-46) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 47 | [`store round trips a value`](#case-47) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 48 | [`takes ten percent off the total`](#case-48) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 49 | [`the cache returns a stored value`](#case-49) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 50 | [`the server answers health`](#case-50) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 51 | [`the service reports its version`](#case-51) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 52 | [`the store keeps a value on disk`](#case-52) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 53 | [`totals the cart`](#case-53) | [`verdict`](checks/verdict/check.mjs) | clean | pass | good, passes | OK |
| 54 | [`every row is validated`](#case-54) | [`conditional`](checks/conditional/check.mjs) | conditional-logic | pass | good, passes | OK |
| 55 | [`creating a user validates, stores and notifies`](#case-55) | [`verdict`](checks/verdict/check.mjs) | eager | pass | good, passes | OK |
| 56 | [`rejects a blank name`](#case-56) | [`conditional`](checks/conditional/check.mjs) | early-return | escalate | slop, needs eyes | OK |
| 57 | [`loads the draft`](#case-57) | [`runs`](checks/runs/check.mjs) | focused | escalate | good, needs eyes | OK |
| 58 | [`saves the draft`](#case-58) | [`runs`](checks/runs/check.mjs) | focused | escalate | good, needs eyes | OK |
| 59 | [`slugs the tenant name`](#case-59) | [`verdict`](checks/verdict/check.mjs) | general-fixture | pass | good, passes | OK |
| 60 | [`indexes both words`](#case-60) | [`resilient`](checks/resilient/check.mjs) | implementation-coupled | either | good, passes | OK |
| 61 | [`forwards the payload`](#case-61) | [`asserts`](checks/asserts/check.mjs) | interaction-only | escalate | weak, needs eyes | OK |
| 62 | [`notifies the listener`](#case-62) | [`asserts`](checks/asserts/check.mjs) | interaction-only | escalate | weak, needs eyes | OK |
| 63 | [`publishes twice`](#case-63) | [`asserts`](checks/asserts/check.mjs) | interaction-only | escalate | unclassified, needs eyes | OK |
| 64 | [`maps a paid, unshipped order to its status code`](#case-64) | [`verdict`](checks/verdict/check.mjs) | magic-number | pass | good, passes | OK |
| 65 | [`accepts the token from the mail`](#case-65) | [`automated`](checks/automated/check.mjs) | manual | pass | good, passes | OK |
| 66 | [`computes the tax`](#case-66) | [`verdict`](checks/verdict/check.mjs) | name-only | escalate | weak, needs eyes | OK |
| 67 | [`computes the tax due`](#case-67) | [`verdict`](checks/verdict/check.mjs) | name-only | escalate | weak, needs eyes | OK |
| 68 | [`sorts rows by name`](#case-68) | [`verdict`](checks/verdict/check.mjs) | name-only | escalate | weak, needs eyes | OK |
| 69 | [`validates email addresses`](#case-69) | [`verdict`](checks/verdict/check.mjs) | name-only | either | good, passes | OK |
| 70 | [`both jobs report in start order`](#case-70) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | good, passes | OK |
| 71 | [`debounce fires once`](#case-71) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | either | good, passes | OK |
| 72 | [`the remote catalogue lists the widget`](#case-72) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | good, passes | OK |
| 73 | [`the retry lands within the window`](#case-73) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | good, passes | OK |
| 74 | [`the sorter keeps every random value`](#case-74) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | good, passes | OK |
| 75 | [`resolves the route of a request`](#case-75) | [`verdict`](checks/verdict/check.mjs) | obscure | pass | good, passes | OK |
| 76 | [`finds no imports in an empty file`](#case-76) | [`positive`](checks/positive/check.mjs) | only-negative | escalate | weak, needs eyes | OK |
| 77 | [`no edge for a comment`](#case-77) | [`positive`](checks/positive/check.mjs) | only-negative | escalate | weak, needs eyes | OK |
| 78 | [`parses a well formed header`](#case-78) | [`positive`](checks/positive/check.mjs) | only-negative | escalate | weak, needs eyes | OK |
| 79 | [`returns null for an unknown setting`](#case-79) | [`positive`](checks/positive/check.mjs) | only-negative | escalate | weak, needs eyes | OK |
| 80 | [`events are dispatched`](#case-80) | [`can-fail`](checks/can-fail/check.mjs) | passes-with-zero | escalate | weak, needs eyes | OK |
| 81 | [`imports are folded`](#case-81) | [`can-fail`](checks/can-fail/check.mjs) | passes-with-zero | escalate | weak, needs eyes | OK |
| 82 | [`reader round trips`](#case-82) | [`can-fail`](checks/can-fail/check.mjs) | self-reference | escalate | slop, needs eyes | OK |
| 83 | [`the two totals match`](#case-83) | [`can-fail`](checks/can-fail/check.mjs) | self-reference | escalate | slop, needs eyes | OK |
| 84 | [`builds three steps`](#case-84) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | unclassified, needs eyes | OK |
| 85 | [`loads the profile fields`](#case-85) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | weak, needs eyes | OK |
| 86 | [`planner returns roads`](#case-86) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | unclassified, needs eyes | OK |
| 87 | [`returns a list of routes`](#case-87) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | weak, needs eyes | OK |
| 88 | [`sorts by price ascending`](#case-88) | [`verdict`](checks/verdict/check.mjs) | silent-failure | pass | good, passes | OK |
| 89 | [`handles overflow`](#case-89) | [`runs`](checks/runs/check.mjs) | skipped | escalate | slop, needs eyes | OK |
| 90 | [`parses a dotted key`](#case-90) | [`runs`](checks/runs/check.mjs) | skipped | escalate | slop, needs eyes | OK |
| 91 | [`rejects a malformed header`](#case-91) | [`runs`](checks/runs/check.mjs) | skipped | escalate | slop, needs eyes | OK |
| 92 | [`rejects a stale token`](#case-92) | [`runs`](checks/runs/check.mjs) | skipped | escalate | slop, needs eyes | OK |
| 93 | [`splits a dotted key`](#case-93) | [`runs`](checks/runs/check.mjs) | skipped | escalate | unclassified, needs eyes | OK |
| 94 | [`finds the largest prime below ten million`](#case-94) | [`verdict`](checks/verdict/check.mjs) | slow | pass | good, passes | OK |
| 95 | [`the package entry loads`](#case-95) | [`verdict`](checks/verdict/check.mjs) | smoke | escalate | unclassified, needs eyes | OK |
| 96 | [`reads the port from the environment`](#case-96) | [`restores`](checks/restores/check.mjs) | state-leak | pass | good, passes | OK |
| 97 | [`the reminder fires after an hour`](#case-97) | [`restores`](checks/restores/check.mjs) | state-leak | pass | good, passes | OK |
| 98 | [`slugify lowercases through normalise`](#case-98) | [`resilient`](checks/resilient/check.mjs) | structure-dependent | pass | good, passes | OK |
| 99 | [`the build is green`](#case-99) | [`can-fail`](checks/can-fail/check.mjs) | tautology | escalate | unclassified, needs eyes | OK |
| 100 | [`the world is sane`](#case-100) | [`can-fail`](checks/can-fail/check.mjs) | tautology | escalate | unclassified, needs eyes | OK |
| 101 | [`reads the port from the sample file`](#case-101) | [`verdict`](checks/verdict/check.mjs) | uncontrolled-resource | pass | good, passes | OK |
| 102 | [`the summary is produced`](#case-102) | [`can-fail`](checks/can-fail/check.mjs) | vacuous | escalate | weak, needs eyes | OK |
| 103 | [`works`](#case-103) | [`verdict`](checks/verdict/check.mjs) | vague-name | pass | good, passes | OK |
| 104 | [`reads the major version`](#case-104) | [`verdict`](checks/verdict/check.mjs) | weak-assert | either | weak, needs eyes | OK |
| 105 | [`builds a job with the given name`](#case-105) | [`verdict`](checks/verdict/check.mjs) | wrong-reason | either | good, passes | OK |
| 106 | [`reports no booking for a free slot`](#case-106) | [`positive`](checks/positive/check.mjs) | wrong-reason | either | weak, needs eyes | OK |
| 107 | [`saves the user`](#case-107) | [`asserts`](checks/asserts/check.mjs) | wrong-reason | escalate | weak, needs eyes | OK |

## Case details: qwen3.8-flash-next-mtp

Click a case to open it. The cases that are not OK are open.

<details open><summary><a id="case-1"></a>1. <code>merges the options</code> · commented-out · <b>WRONG check</b></summary>

```js
test("merges the options", () => {
  // expect(mergeOptions({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  expect(true).toBe(true);
})
```
- **Known defect:** commented-out. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` no, `asserts` inexact. Note: The real assertion is commented out, beside a tautology. Case file [`checks/asserts/cases/commented-out-merge/case.mjs`](checks/asserts/cases/commented-out-merge/case.mjs), line 9. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md); [Web Platform Tests, Review Checklist: "The test does not contain commented-out code"](https://web-platform-tests.org/reviewing-tests/checklist.html).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` no (0.00) · `can_fail_c` no (0.02) → can_fail: 0.01, spread 0.02 (stable). **Escalates:** can_fail contradicts asserts. Label no: match.
  - `positive_a` yes (0.61) · `positive_b` no (0.36) → positive: borderline. **Escalates:** positive borderline (spread 0.26).
  - No escalation: `asserts_exact` yes (0.86) · `asserts_written` yes (0.98) · `asserts_same` yes (0.51) · `asserts_shape` no (0.19) · `asserts_mock` no (0.04) → asserts: behaviour. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** **`asserts` inexact, tool behaviour**.
</details>
<details open><summary><a id="case-2"></a>2. <code>parses config</code> · commented-out · <b>WRONG check</b></summary>

```js
test("parses config", () => {
  // expect(parseConfig("a=1")).toEqual({ a: "1" });
  expect(true).toBe(true);
})
```
- **Known defect:** commented-out. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `asserts` inexact. Note: commented-out assertion beside a tautology. Case file [`checks/asserts/cases/commented-out/case.mjs`](checks/asserts/cases/commented-out/case.mjs), line 8. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md); [Web Platform Tests, Review Checklist: "The test does not contain commented-out code"](https://web-platform-tests.org/reviewing-tests/checklist.html).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` no (0.00) · `can_fail_c` no (0.04) → can_fail: 0.02, spread 0.03 (stable). **Escalates:** can_fail contradicts asserts.
  - `positive_a` no (0.49) · `positive_b` no (0.40) → positive: no. **Escalates:** no positive assertion.
  - No escalation: `asserts_exact` yes (0.82) · `asserts_written` yes (0.94) · `asserts_same` yes (0.60) · `asserts_shape` no (0.18) · `asserts_mock` no (0.03) → asserts: behaviour. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** **`asserts` inexact, tool behaviour**.
</details>
<details open><summary><a id="case-3"></a>3. <code>the pipeline parses, formats and lints</code> · eager · <b>FALSE positive</b></summary>

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
- **Known defect:** eager. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: A real pipeline check, but parse, format and lint are three features asserted in one body. Case file [`checks/verdict/cases/three-features/case.mjs`](checks/verdict/cases/three-features/case.mjs), line 5. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Eager Test (in Obscure Test)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** good, needs eyes.
  - `positive_a` no (0.30) · `positive_b` yes (0.98) → positive: unstable. **Escalates:** positive unstable (spread 0.69).
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.17) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: behaviour. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details open><summary><a id="case-4"></a>4. <code>resolves the status labels</code> · from-code · <b>WRONG can_fail</b></summary>

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
- **Known defect:** from-code. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` no, `asserts` from-code. Note: The expected value is the code under test own constant, so the test agrees by construction and cannot fail. Case file [`checks/asserts/cases/status-table/case.mjs`](checks/asserts/cases/status-table/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` yes (0.99) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). **WRONG can_fail:** label no, tool 1.00.
  - `asserts_exact` yes (0.99) · `asserts_written` no (0.02) · `asserts_same` yes (0.87) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: from-code. **Escalates:** asserts from-code.
  - No escalation: `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` from-code: match.
</details>
<details open><summary><a id="case-5"></a>5. <code>taxes the standard rate</code> · from-code · <b>WRONG can_fail</b></summary>

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
- **Known defect:** from-code. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` no, `asserts` from-code. Note: The expected value is the code under test own constant, so the test agrees by construction and cannot fail. Case file [`checks/asserts/cases/constant-copy/case.mjs`](checks/asserts/cases/constant-copy/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` yes (0.99) · `can_fail_c` yes (1.00) → can_fail: 0.99, spread 0.01 (stable). **WRONG can_fail:** label no, tool 0.99.
  - `asserts_exact` yes (0.97) · `asserts_written` no (0.01) · `asserts_same` yes (0.96) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: from-code. **Escalates:** asserts from-code.
  - No escalation: `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` from-code: match.
</details>
<details open><summary><a id="case-6"></a>6. <code>the token has not expired yet</code> · non-deterministic · <b>FALSE positive</b></summary>

```js
test("the token has not expired yet", () => {
  const token = issueToken({ ttlMs: 60_000 });
  expect(token.expiresAt).toBeGreaterThan(Date.now());
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no. Note: A real expiry check, but reading Date.now makes the result depend on when the test runs. Case file [`checks/deterministic/cases/clock/case.mjs`](checks/deterministic/cases/clock/case.mjs), line 5. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** unclassified, needs eyes.
  - `asserts_exact` yes (0.55) · `asserts_written` yes (0.75) · `asserts_same` no (0.22) · `asserts_shape` no (0.01) · `asserts_mock` no (0.00). **Escalates:** asserts unstable (unsure exact 0.55).
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `positive_a` yes (0.72) · `positive_b` yes (0.96) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `deterministic` (non-deterministic) · unanswered: none.
- **Label checks:** `deterministic` no: match.
</details>
<details open><summary><a id="case-7"></a>7. <code>dispatches to the registered handler</code> · order-dependent · <b>WRONG check</b></summary>

```js
test("dispatches to the registered handler", () => {
  expect(registry.dispatch("ping")).toBe("pong");
})
```

Setup:

```js
const registry = new Registry();
```
- **Known defect:** order-dependent. **Check:** [`isolated`](checks/isolated/check.mjs). **Expected:** pass, `can_fail` yes, `isolated` no. Note: It passes only after the test above has run. Case file [`checks/isolated/cases/handler-registry/case.mjs`](checks/isolated/cases/handler-registry/case.mjs), line 12. Sources: [Kent Beck, Test Desiderata (2019): Isolated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.19) · `asserts_shape` no (0.01) · `asserts_mock` no (0.02) → asserts: behaviour. `positive_a` yes (0.97) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `automated` (manual) · unanswered: none.
- **Label checks:** **`isolated` no, tool yes**.
</details>
<details open><summary><a id="case-8"></a>8. <code>parse is stable</code> · self-reference · <b>WRONG can_fail</b></summary>

```js
test("parse is stable", () => {
  expect(parse(src)).toEqual(parse(src));
})
```
- **Known defect:** self-reference. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: Both sides call the same production function, so the comparison is true by construction. Case file [`checks/can-fail/cases/self-parse/case.mjs`](checks/can-fail/cases/self-parse/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` yes (0.85) · `can_fail_c` yes (0.99) → can_fail: 0.92, spread 0.14 (stable). **WRONG can_fail:** label no, tool 0.92.
  - `asserts_exact` yes (0.77) · `asserts_written` no (0.06) · `asserts_same` yes (1.00) · `asserts_shape` no (0.02) · `asserts_mock` no (0.01) → asserts: from-code. **Escalates:** asserts from-code.
  - `positive_a` no (0.29) · `positive_b` yes (0.83) → positive: unstable. **Escalates:** positive unstable (spread 0.54).
  - No escalation: runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details open><summary><a id="case-9"></a>9. <code>registers a handler</code> · state-leak · <b>WRONG check</b></summary>

```js
test("registers a handler", () => {
  registry.add("ping", () => "pong");
  expect(registry.dispatch("ping")).toBe("pong");
})
```

Setup:

```js
const registry = new Registry();
```
- **Known defect:** state-leak. **Check:** [`isolated`](checks/isolated/check.mjs). **Expected:** pass, `can_fail` yes, `isolated` yes, `restores` no. Note: It builds what it reads, but it leaves the shared registry changed. Case file [`checks/isolated/cases/handler-registry/case.mjs`](checks/isolated/cases/handler-registry/case.mjs), line 7. Sources: [Kent Beck, Test Desiderata (2019): Isolated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.41) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `isolated` yes: match · **`restores` no, tool yes**.
</details>
<details open><summary><a id="case-10"></a>10. <code>the queue is not negative</code> · vacuous · <b>WRONG can_fail</b></summary>

```js
test("the queue is not negative", () => {
  expect(queue.length).toBeGreaterThanOrEqual(0);
})
```
- **Known defect:** vacuous. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: A length is never negative, so the bound is always true. Case file [`checks/can-fail/cases/count-nonnegative/case.mjs`](checks/can-fail/cases/count-nonnegative/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Vacuous / passes-with-zero](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` yes (0.88) · `can_fail_c` yes (1.00) → can_fail: 0.94, spread 0.11 (stable). **WRONG can_fail:** label no, tool 0.94.
  - `asserts_exact` no (0.03) · `asserts_written` yes (0.99) · `asserts_same` yes (0.50) · `asserts_shape` yes (0.82) · `asserts_mock` no (0.00) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.43) · `positive_b` yes (0.91) → positive: borderline. **Escalates:** positive borderline (spread 0.48).
  - No escalation: runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details open><summary><a id="case-11"></a>11. <code>normalise trims the title</code> · wrong-reason · <b>WRONG can_fail</b></summary>

```js
test("normalise trims the title", () => {
  const input = { title: "  hello  " };
  normalise(input);
  expect(input.title).toBe("  hello  ");
})
```
Code under test, [`checks/verdict/cases/asserts-input/code.mjs`](checks/verdict/cases/asserts-input/code.mjs):

```js
export function normalise(record) {
  return { ...record, title: record.title.trim() };
}
```
- **Known defect:** wrong-reason. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate, `can_fail` no, `asserts` inexact. Note: The name promises a trimmed title, but the assertion reads the untouched input, so broken trimming still passes. Case file [`checks/verdict/cases/asserts-input/case.mjs`](checks/verdict/cases/asserts-input/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Passes for the wrong reason](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, needs eyes.
  - `can_fail_a` yes (0.69) · `can_fail_c` yes (0.94) → can_fail: 0.82, spread 0.25 (stable). **WRONG can_fail:** label no, tool 0.82.
  - `positive_a` yes (0.71) · `positive_b` yes (0.98) → positive: borderline. **Escalates:** positive borderline (spread 0.27).
  - No escalation: `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.09) · `asserts_shape` no (0.01) · `asserts_mock` no (0.00) → asserts: behaviour. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `restores` (state-leak) · unanswered: none.
- **Label checks:** **`asserts` inexact, tool behaviour**.
</details>
<details><summary><a id="case-12"></a>12. <code>builds the graph</code> · ambiguous · OK</summary>

```js
test("builds the graph", () => {
  const graph = build();
  expect(Array.isArray(graph.nodes)).toBe(true);
  expect(graph.nodes.length).toBeGreaterThan(0);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: two shape assertions. Case file [`checks/verdict/cases/mixed-shape/case.mjs`](checks/verdict/cases/mixed-shape/case.mjs), line 5. Sources: [Xuezhi Wang et al., Self-Consistency Improves Chain of Thought Reasoning (ICLR 2023)](https://arxiv.org/abs/2203.11171).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` no (0.19) · `asserts_written` yes (0.94) · `asserts_same` no (0.25) · `asserts_shape` yes (0.99) · `asserts_mock` no (0.01) → asserts: shape-only. **Escalates:** asserts shape-only.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). `positive_a` yes (0.99) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-13"></a>13. <code>collects the graph nodes</code> · ambiguous · OK</summary>

```js
test("collects the graph nodes", () => {
  const nodes = collect(graph);
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBeGreaterThan(0);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: Both assertions check the shape and never the node values, so the paraphrased gates disagree. Case file [`checks/verdict/cases/mixed-graph-shapes/case.mjs`](checks/verdict/cases/mixed-graph-shapes/case.mjs), line 5. Sources: [Xuezhi Wang et al., Self-Consistency Improves Chain of Thought Reasoning (ICLR 2023)](https://arxiv.org/abs/2203.11171).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` no (0.11) · `asserts_written` yes (0.97) · `asserts_same` no (0.25) · `asserts_shape` yes (0.99) · `asserts_mock` no (0.01) → asserts: shape-only. **Escalates:** asserts shape-only.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). `positive_a` yes (0.99) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-14"></a>14. <code>retries once</code> · ambiguous · OK</summary>

```js
test("retries once", () => {
  const fn = mock(flakyOperation);
  retry(fn);
  expect(fn).toHaveBeenCalledTimes(2);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: interaction assertion with a specific count. Case file [`checks/verdict/cases/mixed-mock/case.mjs`](checks/verdict/cases/mixed-mock/case.mjs), line 5. Sources: [Xuezhi Wang et al., Self-Consistency Improves Chain of Thought Reasoning (ICLR 2023)](https://arxiv.org/abs/2203.11171).
- **What decided it:** unclassified, needs eyes.
  - `asserts_exact` yes (0.92) · `asserts_written` yes (1.00) · `asserts_same` no (0.46) · `asserts_shape` no (0.02) · `asserts_mock` yes (0.98). **Escalates:** asserts unstable (exact vs interaction-only).
  - `positive_a` yes (0.59) · `positive_b` yes (0.94) → positive: borderline. **Escalates:** positive borderline (spread 0.35).
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `restores` (state-leak) · unanswered: none.
</details>
<details><summary><a id="case-15"></a>15. <code>the schema is sound</code> · ambiguous · OK</summary>

```js
test("the schema is sound", () => {
  expect(true).toBe(true);
  expect(schema.fields.length).toBeGreaterThan(0);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: A tautology sits beside a weak shape assertion, so the paraphrased gates disagree. Case file [`checks/verdict/cases/mixed-world-shape/case.mjs`](checks/verdict/cases/mixed-world-shape/case.mjs), line 5. Sources: [Xuezhi Wang et al., Self-Consistency Improves Chain of Thought Reasoning (ICLR 2023)](https://arxiv.org/abs/2203.11171).
- **What decided it:** unclassified, needs eyes.
  - `asserts_exact` yes (0.75) · `asserts_written` yes (0.99) · `asserts_same` no (0.35) · `asserts_shape` yes (0.72) · `asserts_mock` no (0.00). **Escalates:** asserts unstable (exact vs shape-only).
  - No escalation: `can_fail_a` yes (0.94) · `can_fail_c` yes (1.00) → can_fail: 0.97, spread 0.06 (stable). `positive_a` yes (0.98) · `positive_b` yes (0.96) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-16"></a>16. <code>the world is sane</code> · ambiguous · OK</summary>

```js
test("the world is sane", () => {
  expect(true).toBe(true);
  expect(add.length).toBeGreaterThan(0);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: half tautology, half weak shape assertion. Case file [`checks/verdict/cases/mixed-tautology/case.mjs`](checks/verdict/cases/mixed-tautology/case.mjs), line 5. Sources: [Xuezhi Wang et al., Self-Consistency Improves Chain of Thought Reasoning (ICLR 2023)](https://arxiv.org/abs/2203.11171).
- **What decided it:** unclassified, needs eyes.
  - `asserts_exact` yes (0.60) · `asserts_written` yes (0.98) · `asserts_same` no (0.30) · `asserts_shape` no (0.06) · `asserts_mock` no (0.01). **Escalates:** asserts unstable (unsure exact 0.60).
  - No escalation: `can_fail_a` yes (0.90) · `can_fail_c` yes (0.99) → can_fail: 0.95, spread 0.09 (stable). `positive_a` yes (0.93) · `positive_b` yes (0.94) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-17"></a>17. <code>a new job starts queued with no steps</code> · clean · OK</summary>

```js
test("a new job starts queued with no steps", () => {
  expect(buildJob({ name: "nightly" })).toEqual({ name: "nightly", status: "queued", steps: [] });
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: One action, one result. Case file [`checks/verdict/cases/one-result-many-fields/case.mjs`](checks/verdict/cases/one-result-many-fields/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Eager Test (in Obscure Test and Assertion Roulette)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.10) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.94) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-18"></a>18. <code>a seeded shuffle gives a fixed order</code> · clean · OK</summary>

```js
test("a seeded shuffle gives a fixed order", () => {
  const rng = seededRandom(42);
  expect(shuffle([1, 2, 3, 4], rng)).toEqual([3, 1, 4, 2]);
})
```
- **Known defect:** none, a clean test. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` yes. Note: The randomness is seeded. Case file [`checks/deterministic/cases/seeded-shuffle/case.mjs`](checks/deterministic/cases/seeded-shuffle/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.25) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `deterministic` yes: match.
</details>
<details><summary><a id="case-19"></a>19. <code>a token expires after its time to live</code> · clean · OK</summary>

```js
test("a token expires after its time to live", () => {
  const token = issueToken({ ttlMs: 500, now: () => 1_000 });
  expect(token.expiresAt).toBe(1_500);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` yes. Note: The clock is injected, so it is controlled and deterministic. Case file [`checks/verdict/cases/ttl-expiry/case.mjs`](checks/verdict/cases/ttl-expiry/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Resource Optimism (in Erratic Test)](http://xunitpatterns.com/Erratic%20Test.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.20) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `deterministic` yes: match.
</details>
<details><summary><a id="case-20"></a>20. <code>add handles negatives</code> · clean · OK</summary>

```js
test("add handles negatives", () => {
  expect(add(-2, -3)).toBe(-5);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `deterministic` yes, `resilient` yes, `verdict` good. Note: a clean unit guard. Case file [`checks/verdict/cases/good-unit-add/case.mjs`](checks/verdict/cases/good-unit-add/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.21) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.98) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `deterministic` yes: match · `resilient` yes: match · `verdict` good: match.
</details>
<details><summary><a id="case-21"></a>21. <code>adds two numbers</code> · clean · OK</summary>

```js
test("adds two numbers", () => {
  expect(add(2, 3)).toBe(5);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: One small unit in isolation. Case file [`checks/verdict/cases/pure-add/case.mjs`](checks/verdict/cases/pure-add/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy](http://xunitpatterns.com/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.12) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.98) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-22"></a>22. <code>an invoice falls due thirty days after it is issued</code> · clean · OK</summary>

```js
test("an invoice falls due thirty days after it is issued", () => {
  const DUE_IN_DAYS = 30;
  expect(dueDate("2026-01-01", DUE_IN_DAYS)).toBe("2026-01-31");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: The expected date follows from the input and the named constant. Case file [`checks/verdict/cases/due-date/case.mjs`](checks/verdict/cases/due-date/case.mjs), line 5. Sources: [testsmells.org, Open Catalog of Test Smells: Magic Number Test](https://testsmells.org/pages/testsmells.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.06) · `asserts_shape` no (0.00) · `asserts_mock` no (0.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-23"></a>23. <code>capitalises a lower case name</code> · clean · OK</summary>

```js
test("capitalises a lower case name", () => {
  expect(capitalise("ada")).toBe("Ada");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: Everything is visible. Case file [`checks/verdict/cases/first-letter/case.mjs`](checks/verdict/cases/first-letter/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Readable](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.09) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-24"></a>24. <code>capitalises the first letter</code> · clean · OK</summary>

```js
test("capitalises the first letter", () => {
  expect(capitalise("ada")).toBe("Ada");
})
```
- **Known defect:** none, a clean test. **Check:** [`conditional`](checks/conditional/check.mjs). **Expected:** pass, `can_fail` yes, `conditional` yes. Note: No branch, loop, or catch. Case file [`checks/conditional/cases/straight-line/case.mjs`](checks/conditional/cases/straight-line/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Conditional Test Logic](http://xunitpatterns.com/Conditional%20Test%20Logic.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.15) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `conditional` yes: match.
</details>
<details><summary><a id="case-25"></a>25. <code>converts minutes to seconds</code> · clean · OK</summary>

```js
test("converts minutes to seconds", () => {
  expect(toSeconds(3)).toBe(180);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `deterministic` yes, `resilient` yes, `verdict` good. Note: a real guard. Case file [`checks/verdict/cases/good-unit-seconds/case.mjs`](checks/verdict/cases/good-unit-seconds/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.11) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `deterministic` yes: match · `resilient` yes: match · `verdict` good: match.
</details>
<details><summary><a id="case-26"></a>26. <code>counts the words in a sentence</code> · clean · OK</summary>

```js
test("counts the words in a sentence", () => {
  expect(wordCount("a b c")).toBe(3);
})
```
- **Known defect:** none, a clean test. **Check:** [`isolated`](checks/isolated/check.mjs). **Expected:** pass, `can_fail` yes, `isolated` yes. Note: No shared state. Case file [`checks/isolated/cases/word-count/case.mjs`](checks/isolated/cases/word-count/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Isolated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.14) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `isolated` yes: match.
</details>
<details><summary><a id="case-27"></a>27. <code>debounce fires once after the wait</code> · clean · OK</summary>

```js
test("debounce fires once after the wait", () => {
  vi.useFakeTimers();
  const calls = [];
  const debounced = debounce(() => calls.push(1), 20);
  debounced();
  debounced();
  vi.advanceTimersByTime(20);
  expect(calls).toEqual([1]);
  vi.useRealTimers();
})
```
- **Known defect:** none, a clean test. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` yes, `restores` yes. Note: The timers are faked and restored. Case file [`checks/deterministic/cases/debounce-wait/case.mjs`](checks/deterministic/cases/debounce-wait/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.41) · `asserts_shape` no (0.01) · `asserts_mock` no (0.03) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `deterministic` yes: match · `restores` yes: match.
</details>
<details><summary><a id="case-28"></a>28. <code>finds the imports of a file</code> · clean · OK</summary>

```js
test("finds the imports of a file", () => {
  expect(findImports("")).toEqual([]);
  expect(findImports('import a from "b";')).toEqual([{ name: "a", from: "b" }]);
})
```
- **Known defect:** none, a clean test. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** pass, `can_fail` yes, `positive` yes. Note: One assertion names a value that must be produced, beside the empty case. Case file [`checks/positive/cases/import-pair/case.mjs`](checks/positive/cases/import-pair/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (0.99) · `asserts_written` yes (1.00) · `asserts_same` no (0.10) · `asserts_shape` no (0.01) · `asserts_mock` no (0.02) → asserts: behaviour. `positive_a` yes (0.95) · `positive_b` yes (0.74) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `positive` yes: match.
</details>
<details><summary><a id="case-29"></a>29. <code>formats a date as ISO</code> · clean · OK</summary>

```js
test("formats a date as ISO", () => {
  expect(formatDate(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05");
})
```
- **Known defect:** none, a clean test. **Check:** [`automated`](checks/automated/check.mjs). **Expected:** pass, `can_fail` yes, `automated` yes. Note: No person needed. Case file [`checks/automated/cases/iso-date/case.mjs`](checks/automated/cases/iso-date/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Automated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.13) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.97) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `automated` yes: match.
</details>
<details><summary><a id="case-30"></a>30. <code>formats a receipt line</code> · clean · OK</summary>

```js
test("formats a receipt line", () => {
  expect(formatReceiptLine("Coffee", 2, 3.5)).toBe("Coffee x2 @ 3.50 = 7.00");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `deterministic` yes, `resilient` yes, `verdict` good. Note: a real guard. Case file [`checks/verdict/cases/good-characterization-receipt/case.mjs`](checks/verdict/cases/good-characterization-receipt/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.08) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `deterministic` yes: match · `resilient` yes: match · `verdict` good: match.
</details>
<details><summary><a id="case-31"></a>31. <code>joins two path parts with a slash</code> · clean · OK</summary>

```js
test("joins two path parts with a slash", () => {
  expect(joinPath(["a", "b"])).toBe("a/b");
})
```
- **Known defect:** none, a clean test. **Check:** [`resilient`](checks/resilient/check.mjs). **Expected:** pass, `can_fail` yes, `resilient` yes. Note: The return value is observable. Case file [`checks/resilient/cases/path-join/case.mjs`](checks/resilient/cases/path-join/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Indirect Testing (in Obscure Test)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.19) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `resilient` yes: match.
</details>
<details><summary><a id="case-32"></a>32. <code>orders the scores from low to high</code> · clean · OK</summary>

```js
test("orders the scores from low to high", () => {
  const scores = [7, 3, 9, 1];
  const expected = [...scores].sort((a, b) => a - b);
  expect(rank(scores)).toEqual(expected);
})
```
- **Known defect:** none, a clean test. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour. Note: The oracle is computed in the test from its own input, without the code under test. Case file [`checks/asserts/cases/sorted-copy/case.mjs`](checks/asserts/cases/sorted-copy/case.mjs), line 4. Sources: [testsmells.org, Open Catalog of Test Smells: Redundant Assertion](https://testsmells.org/pages/testsmells.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (0.99) · `asserts_written` yes (0.61) · `asserts_same` no (0.15) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.98) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` behaviour: match.
</details>
<details><summary><a id="case-33"></a>33. <code>parses a number</code> · clean · OK</summary>

```js
test("parses a number", () => {
  expect(parseNumber("42")).toBe(42);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: The name says which behaviour the test checks. Case file [`checks/verdict/cases/string-to-int/case.mjs`](checks/verdict/cases/string-to-int/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Obscure Test](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.17) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-34"></a>34. <code>parses a semantic version</code> · clean · OK</summary>

```js
test("parses a semantic version", () => {
  expect(parseVersion("1.2.3")).toEqual(EXPECTED);
})
```

Setup:

```js
const EXPECTED = { major: 1, minor: 2, patch: 3 };
```
- **Known defect:** none, a clean test. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `verdict` good. Note: The expected value is a constant the test file declares, so the assertion checks behaviour. Case file [`checks/asserts/cases/named-expected/case.mjs`](checks/asserts/cases/named-expected/case.mjs), line 7. Sources: [testsmells.org, Open Catalog of Test Smells: Magic Number Test](https://testsmells.org/pages/testsmells.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (0.84) · `asserts_same` no (0.26) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `verdict` good: match.
</details>
<details><summary><a id="case-35"></a>35. <code>parses a well formed header</code> · clean · OK</summary>

```js
test("parses a well formed header", () => {
  expect(parseHeader("content-length: 12")).toEqual({ "content-length": "12" });
})
```
- **Known defect:** none, a clean test. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** pass, `can_fail` yes, `runs` yes. Note: A skip on a sibling does not stop this test, and it narrows nothing. Case file [`checks/runs/cases/header-pair/case.mjs`](checks/runs/cases/header-pair/case.mjs), line 8. Sources: [testsmells.org, Open Catalog of Test Smells: Ignored Test](https://testsmells.org/pages/testsmells.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.13) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `runs` yes: match.
</details>
<details><summary><a id="case-36"></a>36. <code>pins the current receipt layout before the rewrite</code> · clean · OK</summary>

```js
test("pins the current receipt layout before the rewrite", () => {
  const order = { lines: [{ name: "Coffee", qty: 2, price: 3.5 }] };
  expect(renderReceipt(order)).toMatchInlineSnapshot(`"Coffee x2 @ 3.50 = 7.00"`);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: The name and the inline snapshot say it pins today's output. Case file [`checks/verdict/cases/receipt-baseline/case.mjs`](checks/verdict/cases/receipt-baseline/case.mjs), line 5. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy](http://xunitpatterns.com/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.22) · `asserts_shape` no (0.00) · `asserts_mock` no (0.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-37"></a>37. <code>reads the port from the environment</code> · clean · OK</summary>

```js
test("reads the port from the environment", () => {
  process.env.PORT = "8081";
  expect(portFromEnv()).toBe(8081);
})
```

Setup:

```js
const previous = process.env.PORT;
```

Fixtures:

```js
afterEach(() => {
  process.env.PORT = previous;
})
```
- **Known defect:** none, a clean test. **Check:** [`restores`](checks/restores/check.mjs). **Expected:** pass, `can_fail` yes, `restores` yes. Note: The afterEach restores PORT. Case file [`checks/restores/cases/env-port/case.mjs`](checks/restores/cases/env-port/case.mjs), line 11. Sources: [Kent Beck, Test Desiderata (2019): Isolated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.11) · `asserts_shape` no (0.00) · `asserts_mock` no (0.00) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `restores` yes: match.
</details>
<details><summary><a id="case-38"></a>38. <code>regression #12: an empty list sums to zero</code> · clean · OK</summary>

```js
test("regression #12: an empty list sums to zero", () => {
  expect(sum([])).toBe(0);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: The name cites a past issue. Case file [`checks/verdict/cases/issue-cited/case.mjs`](checks/verdict/cases/issue-cited/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy](http://xunitpatterns.com/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.19) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.54) · `positive_b` yes (0.62) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-39"></a>39. <code>regression #42: a single import resolves</code> · clean · OK</summary>

```js
test("regression #42: a single import resolves", () => {
  expect(parseImports('import a from "b";')).toEqual([{ name: "a", from: "b" }]);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `deterministic` yes, `resilient` yes, `verdict` good. Note: a clean regression guard. Case file [`checks/verdict/cases/good-regression/case.mjs`](checks/verdict/cases/good-regression/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.11) · `asserts_shape` no (0.00) · `asserts_mock` no (0.02) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `deterministic` yes: match · `resilient` yes: match · `verdict` good: match.
</details>
<details><summary><a id="case-40"></a>40. <code>regression #77: a trimmed name keeps its inner spaces</code> · clean · OK</summary>

```js
test("regression #77: a trimmed name keeps its inner spaces", () => {
  expect(trimName("  Ada  Lovelace  ")).toBe("Ada  Lovelace");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `deterministic` yes, `resilient` yes, `verdict` good. Note: a real guard. Case file [`checks/verdict/cases/good-regression-whitespace/case.mjs`](checks/verdict/cases/good-regression-whitespace/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.11) · `asserts_shape` no (0.00) · `asserts_mock` no (0.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `deterministic` yes: match · `resilient` yes: match · `verdict` good: match.
</details>
<details><summary><a id="case-41"></a>41. <code>rejects a header without a colon</code> · clean · OK</summary>

```js
test("rejects a header without a colon", () => {
  expect(() => parseHeader("content-length 12")).toThrow("missing colon");
})
```
- **Known defect:** none, a clean test. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** pass, `can_fail` yes, `positive` yes. Note: A thrown error with its message is a positive assertion, not a mere non-throw. Case file [`checks/positive/cases/header-error/case.mjs`](checks/positive/cases/header-error/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (0.93) · `asserts_written` yes (1.00) · `asserts_same` no (0.47) · `asserts_shape` no (0.04) · `asserts_mock` no (0.02) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (0.86) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `positive` yes: match.
</details>
<details><summary><a id="case-42"></a>42. <code>removes duplicate tags</code> · clean · OK</summary>

```js
test("removes duplicate tags", () => {
  expect(dedupe(["a", "b", "a"])).toEqual(["a", "b"]);
})
```
- **Known defect:** none, a clean test. **Check:** [`resilient`](checks/resilient/check.mjs). **Expected:** pass, `can_fail` yes, `resilient` yes. Note: Public interface, result only. Case file [`checks/resilient/cases/tag-dedupe/case.mjs`](checks/resilient/cases/tag-dedupe/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Structure-insensitive](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (0.99) · `asserts_written` yes (1.00) · `asserts_same` no (0.18) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.98) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `resilient` yes: match.
</details>
<details><summary><a id="case-43"></a>43. <code>reverses a string</code> · clean · OK</summary>

```js
test("reverses a string", () => {
  expect(reverse("abc")).toBe("cba");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `deterministic` yes, `resilient` yes, `verdict` good. Note: a clean unit guard. Case file [`checks/verdict/cases/good-unit-reverse/case.mjs`](checks/verdict/cases/good-unit-reverse/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.18) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `deterministic` yes: match · `resilient` yes: match · `verdict` good: match.
</details>
<details><summary><a id="case-44"></a>44. <code>rounds to two decimals</code> · clean · OK</summary>

```js
test("rounds to two decimals", () => {
  expect(round2(3.14159)).toBe(3.14);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: Milliseconds. Case file [`checks/verdict/cases/two-decimals/case.mjs`](checks/verdict/cases/two-decimals/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Fast](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.10) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-45"></a>45. <code>slugs a display name</code> · clean · OK</summary>

```js
test("slugs a display name", () => {
  expect(slugify("Hello, World")).toBe("hello-world");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `deterministic` yes, `resilient` yes, `verdict` good. Note: a real guard. Case file [`checks/verdict/cases/good-unit-slug/case.mjs`](checks/verdict/cases/good-unit-slug/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.09) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `deterministic` yes: match · `resilient` yes: match · `verdict` good: match.
</details>
<details><summary><a id="case-46"></a>46. <code>splits a version into its parts</code> · clean · OK</summary>

```js
test("splits a version into its parts", () => {
  expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: toEqual on the whole value. Case file [`checks/verdict/cases/semver-parts/case.mjs`](checks/verdict/cases/semver-parts/case.mjs), line 4. Sources: [Web Platform Tests, Review Checklist: "The test uses the most specific asserts possible"](https://web-platform-tests.org/reviewing-tests/checklist.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (0.99) · `asserts_written` yes (1.00) · `asserts_same` no (0.09) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-47"></a>47. <code>store round trips a value</code> · clean · OK</summary>

```js
test("store round trips a value", async () => {
  const store = await openStore(tmpdir());
  await store.set("k", "v");
  expect(await store.get("k")).toBe("v");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes. Note: a clean integration guard. Case file [`checks/verdict/cases/good-integration/case.mjs`](checks/verdict/cases/good-integration/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.21) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match.
</details>
<details><summary><a id="case-48"></a>48. <code>takes ten percent off the total</code> · clean · OK</summary>

```js
test("takes ten percent off the total", () => {
  const cart = { items: [{ price: 100 }] };
  expect(applyDiscount(cart, 10).total).toBe(90);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: A minimal local fixture. Case file [`checks/verdict/cases/percent-discount/case.mjs`](checks/verdict/cases/percent-discount/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): General Fixture, Irrelevant Information (in Obscure Test)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.16) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-49"></a>49. <code>the cache returns a stored value</code> · clean · OK</summary>

```js
test("the cache returns a stored value", async () => {
  const cache = await openCache(tmpdir());
  await cache.put("session", "abc123");
  expect(await cache.get("session")).toBe("abc123");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes. Note: a real guard. Case file [`checks/verdict/cases/good-integration-cache/case.mjs`](checks/verdict/cases/good-integration-cache/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.19) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match.
</details>
<details><summary><a id="case-50"></a>50. <code>the server answers health</code> · clean · OK</summary>

```js
test("the server answers health", async () => {
  const res = await fetch(base + "/health");
  expect(await res.text()).toBe("ok");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes. Note: a clean end-to-end guard. Case file [`checks/verdict/cases/good-e2e/case.mjs`](checks/verdict/cases/good-e2e/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.07) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `deterministic` (non-deterministic) · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match.
</details>
<details><summary><a id="case-51"></a>51. <code>the service reports its version</code> · clean · OK</summary>

```js
test("the service reports its version", async () => {
  const res = await fetch(base + "/version");
  expect(await res.text()).toBe("2.4.1");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes. Note: a real guard. Case file [`checks/verdict/cases/good-e2e-version/case.mjs`](checks/verdict/cases/good-e2e-version/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.06) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `deterministic` (non-deterministic) · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match.
</details>
<details><summary><a id="case-52"></a>52. <code>the store keeps a value on disk</code> · clean · OK</summary>

```js
test("the store keeps a value on disk", async () => {
  const store = await openStore(await mkdtemp(join(tmpdir(), "store-")));
  await store.set("k", "v");
  expect(await store.get("k")).toBe("v");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: The code runs with a real filesystem. Case file [`checks/verdict/cases/disk-store/case.mjs`](checks/verdict/cases/disk-store/case.mjs), line 8. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy](http://xunitpatterns.com/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (0.99) · `asserts_same` no (0.12) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-53"></a>53. <code>totals the cart</code> · clean · OK</summary>

```js
test("totals the cart", () => {
  expect(cartTotal([{ price: 2, qty: 3 }, { price: 1, qty: 1 }])).toBe(7);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: toBe shows both values on failure. Case file [`checks/verdict/cases/cart-total/case.mjs`](checks/verdict/cases/cart-total/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Assertion Roulette (Missing Assertion Message)](http://xunitpatterns.com/Assertion%20Roulette.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.09) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-54"></a>54. <code>every row is validated</code> · conditional-logic · OK</summary>

```js
test("every row is validated", () => {
  const rows = validateAll([{ id: 1 }, { id: 2 }]);
  for (const row of rows) expect(row.valid).toBe(true);
})
```
- **Known defect:** conditional-logic. **Check:** [`conditional`](checks/conditional/check.mjs). **Expected:** pass, `can_fail` yes, `conditional` no. Note: If validateAll returns an empty list, the loop asserts nothing. Case file [`checks/conditional/cases/row-loop/case.mjs`](checks/conditional/cases/row-loop/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Conditional Test Logic](http://xunitpatterns.com/Conditional%20Test%20Logic.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (0.99) · `asserts_written` yes (1.00) · `asserts_same` no (0.37) · `asserts_shape` no (0.02) · `asserts_mock` no (0.00) → asserts: behaviour. `positive_a` yes (0.91) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `conditional` (conditional) · unanswered: none.
- **Label checks:** `conditional` no: match.
</details>
<details><summary><a id="case-55"></a>55. <code>creating a user validates, stores and notifies</code> · eager · OK</summary>

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
- **Known defect:** eager. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: A real user-creation check, but validation, storage and notification are three unrelated behaviours. Case file [`checks/verdict/cases/unrelated/case.mjs`](checks/verdict/cases/unrelated/case.mjs), line 5. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Eager Test (in Obscure Test)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (0.97) · `asserts_written` yes (0.97) · `asserts_same` no (0.31) · `asserts_shape` no (0.01) · `asserts_mock` no (0.02) → asserts: behaviour. `positive_a` yes (0.98) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-56"></a>56. <code>rejects a blank name</code> · early-return · OK</summary>

```js
test("rejects a blank name", () => {
  return;
  expect(validateName("")).toBe(false);
})
```
- **Known defect:** early-return. **Check:** [`conditional`](checks/conditional/check.mjs). **Expected:** escalate, `can_fail` no, `conditional` no. Note: The early return makes the assertion unreachable, so the test cannot fail. Case file [`checks/conditional/cases/early-return-name/case.mjs`](checks/conditional/cases/early-return-name/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` no (0.01) · `can_fail_c` no (0.02) → can_fail: 0.01, spread 0.01 (stable). **Escalates:** can_fail contradicts asserts. Label no: match.
  - `positive_a` no (0.23) · `positive_b` no (0.24) → positive: no. **Escalates:** no positive assertion.
  - No escalation: `asserts_exact` yes (0.99) · `asserts_written` yes (1.00) · `asserts_same` yes (0.53) · `asserts_shape` no (0.09) · `asserts_mock` no (0.03) → asserts: behaviour. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `conditional` (conditional) · unanswered: none.
- **Label checks:** `conditional` no: match.
</details>
<details><summary><a id="case-57"></a>57. <code>loads the draft</code> · focused · OK</summary>

```js
it("loads the draft", () => {
  expect(loadDraft("draft")).toEqual("draft");
})
```
- **Known defect:** focused. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: The plain test inherits the file-level focus from it.only. Case file [`checks/runs/cases/focus-draft/case.mjs`](checks/runs/cases/focus-draft/case.mjs), line 10. Extractor notes: `focus-in-file`. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, needs eyes.
  - runs: no, from the extractor's flags. **Escalates:** does not run, or narrows the run.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). `asserts_exact` yes (1.00) · `asserts_written` yes (0.99) · `asserts_same` yes (0.57) · `asserts_shape` no (0.01) · `asserts_mock` no (0.02) → asserts: behaviour. `positive_a` yes (0.95) · `positive_b` yes (0.99) → positive: yes.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-58"></a>58. <code>saves the draft</code> · focused · OK</summary>

```js
it.only("saves the draft", () => {
  expect(saveDraft("draft")).toBe(true);
})
```
- **Known defect:** focused. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: The it.only focuses the file and narrows the whole run. Case file [`checks/runs/cases/focus-draft/case.mjs`](checks/runs/cases/focus-draft/case.mjs), line 6. Extractor notes: `focus-in-file`. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, needs eyes.
  - runs: no, from the extractor's flags. **Escalates:** does not run, or narrows the run.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.43) · `asserts_shape` no (0.01) · `asserts_mock` no (0.07) → asserts: behaviour. `positive_a` yes (0.96) · `positive_b` yes (0.95) → positive: yes.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-59"></a>59. <code>slugs the tenant name</code> · general-fixture · OK</summary>

```js
test("slugs the tenant name", () => {
  expect(tenant.slug).toBe("acme");
})
```

Setup:

```js
let tenant;
```

Fixtures:

```js
beforeEach(() => {
  tenant = createTenant({
    name: "Acme",
    plan: "enterprise",
    region: "eu",
    users: [{ name: "Ada", role: "owner" }, { name: "Bob", role: "member" }],
    invoices: [{ id: 1, total: 100 }, { id: 2, total: 250 }],
    settings: { theme: "dark", locale: "en-GB", mfa: true },
  });
})
```
- **Known defect:** general-fixture. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: Only the name matters; the rest of the fixture is irrelevant. Case file [`checks/verdict/cases/tenant-slug/case.mjs`](checks/verdict/cases/tenant-slug/case.mjs), line 17. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): General Fixture, Irrelevant Information (in Obscure Test)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.13) · `asserts_shape` no (0.01) · `asserts_mock` no (0.00) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-60"></a>60. <code>indexes both words</code> · implementation-coupled · OK</summary>

```js
test("indexes both words", () => {
  const engine = new SearchEngine(["apple", "pear"]);
  expect(engine._index).toEqual({ apple: [0], pear: [1] });
})
```
- **Known defect:** implementation-coupled. **Check:** [`resilient`](checks/resilient/check.mjs). **Expected:** either, `can_fail` yes, `resilient` no. Note: The assertion reads the private _index field. Escalation is welcome but not required. Case file [`checks/resilient/cases/search-index/case.mjs`](checks/resilient/cases/search-index/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Indirect Testing (in Obscure Test)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.08) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `resilient` (structure-dependent) · unanswered: none.
- **Label checks:** `resilient` no: match.
</details>
<details><summary><a id="case-61"></a>61. <code>forwards the payload</code> · interaction-only · OK</summary>

```js
test("forwards the payload", () => {
  const spy = mock(send);
  dispatch(message);
  expect(spy.mock.calls[0][0]).toMatchObject({ id: expect.any(String) });
})
```
- **Known defect:** interaction-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` interaction-only. Note: The mock argument shape can change and fail the test, while the real output stays unchecked. Case file [`checks/asserts/cases/mock-argument/case.mjs`](checks/asserts/cases/mock-argument/case.mjs), line 4. Sources: [Martin Fowler, Mocks Aren't Stubs (2007)](https://martinfowler.com/articles/mocksArentStubs.html).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` no (0.03) · `asserts_written` yes (0.93) · `asserts_same` no (0.32) · `asserts_shape` no (0.49) · `asserts_mock` yes (0.91) → asserts: interaction-only. **Escalates:** asserts interaction-only.
  - No escalation: `can_fail_a` yes (0.99) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.01 (stable). Label yes: match. `positive_a` yes (0.97) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `restores` (state-leak) · unanswered: none.
- **Label checks:** `asserts` interaction-only: match.
</details>
<details><summary><a id="case-62"></a>62. <code>notifies the listener</code> · interaction-only · OK</summary>

```js
test("notifies the listener", () => {
  const spy = mock(notify);
  publish(event);
  expect(spy).toHaveBeenCalled();
})
```
- **Known defect:** interaction-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` interaction-only, `verdict` weak. Note: A missing call fails the test, though the mock stands in for behaviour it never verifies. Case file [`checks/asserts/cases/spy-called/case.mjs`](checks/asserts/cases/spy-called/case.mjs), line 4. Sources: [Martin Fowler, Mocks Aren't Stubs (2007)](https://martinfowler.com/articles/mocksArentStubs.html).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` no (0.22) · `asserts_written` yes (0.56) · `asserts_same` no (0.38) · `asserts_shape` no (0.02) · `asserts_mock` yes (0.99) → asserts: interaction-only. **Escalates:** asserts interaction-only.
  - `positive_a` no (0.22) · `positive_b` yes (0.65) → positive: borderline. **Escalates:** positive borderline (spread 0.43).
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `restores` (state-leak) · unanswered: none.
- **Label checks:** `asserts` interaction-only: match · `verdict` weak: match.
</details>
<details><summary><a id="case-63"></a>63. <code>publishes twice</code> · interaction-only · OK</summary>

```js
test("publishes twice", () => {
  const spy = mock(publish);
  runBatch(items);
  expect(spy).toHaveBeenCalledTimes(2);
})
```
- **Known defect:** interaction-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` interaction-only. Note: A changed call count fails the test, yet the payload of each call is never asserted. Case file [`checks/asserts/cases/spy-count/case.mjs`](checks/asserts/cases/spy-count/case.mjs), line 4. Sources: [Martin Fowler, Mocks Aren't Stubs (2007)](https://martinfowler.com/articles/mocksArentStubs.html).
- **What decided it:** unclassified, needs eyes.
  - `asserts_exact` yes (0.52) · `asserts_written` yes (1.00) · `asserts_same` no (0.29) · `asserts_shape` no (0.03) · `asserts_mock` yes (0.98). **Escalates:** asserts unstable (unsure exact 0.52).
  - `positive_a` yes (0.58) · `positive_b` yes (0.91) → positive: borderline. **Escalates:** positive borderline (spread 0.33).
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. runs: yes, from the extractor's flags.
- **Descriptive:** 4 clean · smells: `restores` (state-leak), `resilient` (structure-dependent) · unanswered: none.
- **Label checks:** `asserts` interaction-only: not committed.
</details>
<details><summary><a id="case-64"></a>64. <code>maps a paid, unshipped order to its status code</code> · magic-number · OK</summary>

```js
test("maps a paid, unshipped order to its status code", () => {
  expect(statusCode({ paid: true, shipped: false })).toBe(7);
})
```
- **Known defect:** magic-number. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: Nothing in the test says what 7 means. Case file [`checks/verdict/cases/order-status/case.mjs`](checks/verdict/cases/order-status/case.mjs), line 4. Sources: [testsmells.org, Open Catalog of Test Smells: Magic Number Test](https://testsmells.org/pages/testsmells.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.11) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-65"></a>65. <code>accepts the token from the mail</code> · manual · OK</summary>

```js
test("accepts the token from the mail", async () => {
  const token = await readLine("paste the token from the mail: ");
  expect(verifyToken(token)).toBe(true);
})
```
- **Known defect:** manual. **Check:** [`automated`](checks/automated/check.mjs). **Expected:** pass, `can_fail` yes, `automated` no. Note: A person must act before the assertion can run. Case file [`checks/automated/cases/pasted-token/case.mjs`](checks/automated/cases/pasted-token/case.mjs), line 6. Sources: [Kent Beck, Test Desiderata (2019): Automated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.16) · `asserts_shape` no (0.03) · `asserts_mock` no (0.03) → asserts: behaviour. `positive_a` yes (0.94) · `positive_b` yes (0.90) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 4 clean · smells: `deterministic` (non-deterministic), `automated` (manual) · unanswered: none.
- **Label checks:** `automated` no: match.
</details>
<details><summary><a id="case-66"></a>66. <code>computes the tax</code> · name-only · OK</summary>

```js
test("computes the tax", () => {
  const tax = computeTax(100);
  expect(tax).toBeDefined();
})
```
- **Known defect:** name-only. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate, `can_fail` no. Note: name-only: toBeDefined is true for any defined value. Case file [`checks/verdict/cases/name-only/case.mjs`](checks/verdict/cases/name-only/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Name-only](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` yes (0.55) · `can_fail_c` no (0.09) → can_fail: 0.32, spread 0.46 (borderline). **Escalates:** can_fail borderline (spread 0.46). Label no: not scored.
  - `asserts_exact` no (0.00) · `asserts_written` no (0.40) · `asserts_same` yes (0.50) · `asserts_shape` yes (0.98) · `asserts_mock` no (0.01) → asserts: shape-only. **Escalates:** asserts shape-only.
  - No escalation: `positive_a` yes (0.69) · `positive_b` yes (0.88) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-67"></a>67. <code>computes the tax due</code> · name-only · OK</summary>

```js
test("computes the tax due", () => {
  const tax = computeTax(100);
  expect(tax).toBeDefined();
})
```
- **Known defect:** name-only. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate, `can_fail` no. Note: The name promises a tax value, while toBeDefined is true for any defined value. Case file [`checks/verdict/cases/tax-defined/case.mjs`](checks/verdict/cases/tax-defined/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Name-only](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` no (0.46) · `can_fail_c` no (0.04) → can_fail: 0.25, spread 0.42 (borderline). **Escalates:** can_fail borderline (spread 0.42). Label no: not scored.
  - `asserts_exact` no (0.00) · `asserts_written` no (0.44) · `asserts_same` yes (0.60) · `asserts_shape` yes (0.98) · `asserts_mock` no (0.01) → asserts: shape-only. **Escalates:** asserts shape-only.
  - No escalation: `positive_a` yes (0.71) · `positive_b` yes (0.74) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-68"></a>68. <code>sorts rows by name</code> · name-only · OK</summary>

```js
test("sorts rows by name", () => {
  const rows = sortRows([{ name: "b" }, { name: "a" }]);
  expect(rows).toHaveLength(2);
})
```
- **Known defect:** name-only. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate, `can_fail` no. Note: The name promises a sort, while the length check holds for any permutation. Case file [`checks/verdict/cases/sort-length/case.mjs`](checks/verdict/cases/sort-length/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Name-only](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` yes (0.56) · `can_fail_c` yes (0.90) → can_fail: 0.73, spread 0.34 (borderline). **Escalates:** can_fail borderline (spread 0.34). Label no: not scored.
  - `asserts_exact` no (0.01) · `asserts_written` yes (0.99) · `asserts_same` no (0.29) · `asserts_shape` yes (0.90) · `asserts_mock` no (0.00) → asserts: shape-only. **Escalates:** asserts shape-only.
  - No escalation: `positive_a` yes (0.77) · `positive_b` yes (0.95) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-69"></a>69. <code>validates email addresses</code> · name-only · OK</summary>

```js
test("validates email addresses", () => {
  expect(isValidEmail("a@b.com")).toBeTruthy();
})
```
- **Known defect:** name-only. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** either, `can_fail` yes. Note: A true result from a boolean validator is a real check. The name promises validation of both kinds, but only one valid address is checked; no question judges that, so the case may pass or escalate. Case file [`checks/verdict/cases/email-truthy/case.mjs`](checks/verdict/cases/email-truthy/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Name-only](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (0.95) · `asserts_written` yes (0.98) · `asserts_same` no (0.34) · `asserts_shape` no (0.05) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.97) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-70"></a>70. <code>both jobs report in start order</code> · non-deterministic · OK</summary>

```js
test("both jobs report in start order", async () => {
  const log = [];
  await Promise.all([runJob("a", log), runJob("b", log)]);
  expect(log).toEqual(["a", "b"]);
})
```
Code under test, [`checks/deterministic/cases/completion-log/code.mjs`](checks/deterministic/cases/completion-log/code.mjs):

```js
export async function runJob(name, log) {
  await fetch(`/jobs/${name}`);
  log.push(name);
}
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no. Note: The jobs finish in network order, so the log order can change between runs. Case file [`checks/deterministic/cases/completion-log/case.mjs`](checks/deterministic/cases/completion-log/case.mjs), line 5. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.21) · `asserts_shape` no (0.01) · `asserts_mock` no (0.07) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `deterministic` (non-deterministic) · unanswered: none.
- **Label checks:** `deterministic` no: match.
</details>
<details><summary><a id="case-71"></a>71. <code>debounce fires once</code> · non-deterministic · OK</summary>

```js
test("debounce fires once", async () => {
  const calls = [];
  const debounced = debounce(() => calls.push(1), 20);
  debounced();
  await sleep(50);
  expect(calls.length).toBe(1);
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** either, `can_fail` yes, `deterministic` no. Note: a real guard, but timer-bound; reported, not escalated. Case file [`checks/deterministic/cases/flaky/case.mjs`](checks/deterministic/cases/flaky/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (0.97) · `asserts_written` yes (1.00) · `asserts_same` no (0.32) · `asserts_shape` no (0.09) · `asserts_mock` no (0.04) → asserts: behaviour. `positive_a` yes (0.96) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `deterministic` (non-deterministic) · unanswered: none.
- **Label checks:** `deterministic` no: match.
</details>
<details><summary><a id="case-72"></a>72. <code>the remote catalogue lists the widget</code> · non-deterministic · OK</summary>

```js
test("the remote catalogue lists the widget", async () => {
  const response = await fetch("https://example.test/catalogue");
  const items = await response.json();
  expect(items).toContain("widget");
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no, `verdict` good. Note: A real catalogue check, but a live fetch makes the result depend on the network. Case file [`checks/deterministic/cases/network/case.mjs`](checks/deterministic/cases/network/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (0.91) · `asserts_written` yes (0.99) · `asserts_same` no (0.05) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.95) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `deterministic` (non-deterministic) · unanswered: none.
- **Label checks:** `deterministic` no: match · `verdict` good: match.
</details>
<details><summary><a id="case-73"></a>73. <code>the retry lands within the window</code> · non-deterministic · OK</summary>

```js
test("the retry lands within the window", async () => {
  const attempts = [];
  retryOnFailure(() => attempts.push(1));
  await sleep(50);
  expect(attempts.length).toBe(2);
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no. Note: A real guard on the retry count, but the fixed sleep makes the outcome depend on scheduling. Case file [`checks/deterministic/cases/timer/case.mjs`](checks/deterministic/cases/timer/case.mjs), line 5. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (0.99) · `can_fail_c` yes (0.99) → can_fail: 0.99, spread 0.01 (stable). Label yes: match. `asserts_exact` yes (0.93) · `asserts_written` yes (0.99) · `asserts_same` no (0.17) · `asserts_shape` no (0.08) · `asserts_mock` no (0.11) → asserts: behaviour. `positive_a` yes (0.95) · `positive_b` yes (0.96) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 4 clean · smells: `deterministic` (non-deterministic), `restores` (state-leak) · unanswered: none.
- **Label checks:** `deterministic` no: match.
</details>
<details><summary><a id="case-74"></a>74. <code>the sorter keeps every random value</code> · non-deterministic · OK</summary>

```js
test("the sorter keeps every random value", () => {
  const input = Array.from({ length: 5 }, () => Math.floor(Math.random() * 100));
  expect(sortNumbers(input)).toEqual([...input].sort((a, b) => a - b));
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no. Note: A real sorting property, but the random input makes a failure hard to reproduce. Case file [`checks/deterministic/cases/randomness/case.mjs`](checks/deterministic/cases/randomness/case.mjs), line 5. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (0.99) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (0.95) · `asserts_written` yes (0.72) · `asserts_same` no (0.43) · `asserts_shape` no (0.00) · `asserts_mock` no (0.00) → asserts: behaviour. `positive_a` yes (0.97) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `deterministic` (non-deterministic) · unanswered: none.
- **Label checks:** `deterministic` no: match.
</details>
<details><summary><a id="case-75"></a>75. <code>resolves the route of a request</code> · obscure · OK</summary>

```js
test("resolves the route of a request", () => {
  expect(resolveRoute(FIXTURE_REQUEST)).toEqual(EXPECTED_ROUTE);
})
```
- **Known defect:** obscure. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour. Note: The values are hidden in a test fixture module, not taken from the code under test. Case file [`checks/verdict/cases/fixture-route/case.mjs`](checks/verdict/cases/fixture-route/case.mjs), line 7. Sources: [Kent Beck, Test Desiderata (2019): Readable](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` no (0.02) · `asserts_same` no (0.22) · `asserts_shape` no (0.01) · `asserts_mock` no (0.02) → asserts: behaviour. `positive_a` yes (0.95) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` behaviour: match.
</details>
<details><summary><a id="case-76"></a>76. <code>finds no imports in an empty file</code> · only-negative · OK</summary>

```js
test("finds no imports in an empty file", () => {
  expect(findImports("")).toEqual([]);
})
```
- **Known defect:** only-negative. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate, `can_fail` yes, `positive` no. Note: Only the empty result is checked, so a finder that never finds anything would pass. Case file [`checks/positive/cases/empty-array/case.mjs`](checks/positive/cases/empty-array/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` yes (0.98) · `asserts_written` yes (1.00) · `asserts_same` no (0.27) · `asserts_shape` yes (0.60) · `asserts_mock` no (0.03). **Escalates:** asserts unstable (unsure shape 0.60).
  - `positive_a` no (0.00) · `positive_b` no (0.05) → positive: no. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `positive` no: match.
</details>
<details><summary><a id="case-77"></a>77. <code>no edge for a comment</code> · only-negative · OK</summary>

```js
test("no edge for a comment", () => {
  expect(resolveEdges("// comment")).toBeNull();
})
```
- **Known defect:** only-negative. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate, `can_fail` yes, `positive` no. Note: no positive/negative pair. Case file [`checks/positive/cases/only-negative/case.mjs`](checks/positive/cases/only-negative/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` yes (0.81) · `asserts_written` yes (1.00) · `asserts_same` no (0.23) · `asserts_shape` no (0.40) · `asserts_mock` no (0.01). **Escalates:** asserts unstable (unsure shape 0.40).
  - `positive_a` no (0.00) · `positive_b` no (0.00) → positive: no. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `positive` no: match.
</details>
<details><summary><a id="case-78"></a>78. <code>parses a well formed header</code> · only-negative · OK</summary>

```js
test("parses a well formed header", () => {
  const run = () => parseHeader("content-length: 12");
  expect(run).not.toThrow();
})
```
- **Known defect:** only-negative. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate, `can_fail` yes, `positive` no. Note: Only that the call does not throw is checked, and the parsed output is never asserted. Case file [`checks/positive/cases/no-throw/case.mjs`](checks/positive/cases/no-throw/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` no (0.09) · `asserts_written` yes (0.90) · `asserts_same` yes (0.57) · `asserts_shape` no (0.26) · `asserts_mock` no (0.05) → asserts: inexact. **Escalates:** asserts inexact.
  - `positive_a` no (0.02) · `positive_b` no (0.01) → positive: no. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` yes (0.97) · `can_fail_c` yes (0.83) → can_fail: 0.90, spread 0.13 (stable). Label yes: match. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `positive` no: match.
</details>
<details><summary><a id="case-79"></a>79. <code>returns null for an unknown setting</code> · only-negative · OK</summary>

```js
test("returns null for an unknown setting", () => {
  expect(readSetting({ theme: "dark" }, "font")).toBeNull();
})
```
- **Known defect:** only-negative. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate, `can_fail` yes, `positive` no. Note: Only the absent lookup is checked, so a reader that always returns null would pass. Case file [`checks/positive/cases/absent-key/case.mjs`](checks/positive/cases/absent-key/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `positive_a` no (0.00) · `positive_b` no (0.02) → positive: no. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (0.99) · `asserts_written` yes (0.99) · `asserts_same` no (0.10) · `asserts_shape` no (0.16) · `asserts_mock` no (0.02) → asserts: behaviour. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `positive` no: match.
</details>
<details><summary><a id="case-80"></a>80. <code>events are dispatched</code> · passes-with-zero · OK</summary>

```js
test("events are dispatched", () => {
  const dispatched = collect();
  expect(dispatched).toBeDefined();
})
```
- **Known defect:** passes-with-zero. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: The check only asks whether the collection is defined, so no dispatch passes. Case file [`checks/can-fail/cases/empty-dispatch/case.mjs`](checks/can-fail/cases/empty-dispatch/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Vacuous / passes-with-zero](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` no (0.11) · `can_fail_c` yes (0.76) → can_fail: 0.43, spread 0.64 (unstable). **Escalates:** can_fail unstable (spread 0.64). Label no: not scored.
  - `asserts_exact` no (0.05) · `asserts_written` yes (0.88) · `asserts_same` yes (0.58) · `asserts_shape` yes (0.80) · `asserts_mock` no (0.03) → asserts: shape-only. **Escalates:** asserts shape-only.
  - No escalation: `positive_a` yes (0.62) · `positive_b` yes (0.69) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-81"></a>81. <code>imports are folded</code> · passes-with-zero · OK</summary>

```js
test("imports are folded", () => {
  const commit = buildCommit([]);
  expect(commit.imports).toBeDefined();
})
```
- **Known defect:** passes-with-zero. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` yes. Note: vacuous: passes when the feature produces nothing. Case file [`checks/can-fail/cases/vacuous-zero/case.mjs`](checks/can-fail/cases/vacuous-zero/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Vacuous / passes-with-zero](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` no (0.01) · `asserts_written` no (0.37) · `asserts_same` no (0.42) · `asserts_shape` yes (0.96) · `asserts_mock` no (0.02) → asserts: shape-only. **Escalates:** asserts shape-only.
  - No escalation: `can_fail_a` yes (0.98) · `can_fail_c` yes (0.99) → can_fail: 0.99, spread 0.01 (stable). Label yes: match. `positive_a` no (0.44) · `positive_b` yes (0.57) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-82"></a>82. <code>reader round trips</code> · self-reference · OK</summary>

```js
test("reader round trips", () => {
  expect(parse(source)).toEqual(parse(source));
})
```
- **Known defect:** self-reference. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: tautology: both sides call the same production code. Case file [`checks/can-fail/cases/tautology-selfreference/case.mjs`](checks/can-fail/cases/tautology-selfreference/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` no (0.36) · `can_fail_c` yes (1.00) → can_fail: 0.68, spread 0.64 (unstable). **Escalates:** can_fail unstable (spread 0.64). Label no: not scored.
  - `asserts_exact` yes (0.92) · `asserts_written` no (0.13) · `asserts_same` yes (1.00) · `asserts_shape` no (0.02) · `asserts_mock` no (0.01) → asserts: from-code. **Escalates:** asserts from-code.
  - `positive_a` yes (0.57) · `positive_b` yes (0.88) → positive: borderline. **Escalates:** positive borderline (spread 0.31).
  - No escalation: runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-83"></a>83. <code>the two totals match</code> · self-reference · OK</summary>

```js
test("the two totals match", () => {
  expect(total(rows)).toBe(total(rows));
})
```
- **Known defect:** self-reference. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: One helper backs both sides, so any change to it moves both sides together. Case file [`checks/can-fail/cases/helper-agreement/case.mjs`](checks/can-fail/cases/helper-agreement/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_exact` yes (0.96) · `asserts_written` no (0.04) · `asserts_same` yes (1.00) · `asserts_shape` no (0.02) · `asserts_mock` no (0.01) → asserts: from-code. **Escalates:** asserts from-code.
  - No escalation: `can_fail_a` no (0.02) · `can_fail_c` no (0.19) → can_fail: 0.10, spread 0.17 (stable). Label no: match. `positive_a` yes (0.75) · `positive_b` yes (0.78) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-84"></a>84. <code>builds three steps</code> · shape-only · OK</summary>

```js
test("builds three steps", () => {
  const steps = planSteps(task);
  expect(steps.length).toBe(3);
})
```
- **Known defect:** shape-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` shape-only. Note: A wrong count fails the test, yet the step contents are never checked. Case file [`checks/asserts/cases/result-length/case.mjs`](checks/asserts/cases/result-length/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Shape-not-value](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** unclassified, needs eyes.
  - `asserts_exact` yes (0.80) · `asserts_written` yes (1.00) · `asserts_same` no (0.17) · `asserts_shape` yes (0.93) · `asserts_mock` no (0.01). **Escalates:** asserts unstable (exact vs shape-only).
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `positive_a` yes (0.96) · `positive_b` yes (0.98) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` shape-only: not committed.
</details>
<details><summary><a id="case-85"></a>85. <code>loads the profile fields</code> · shape-only · OK</summary>

```js
test("loads the profile fields", () => {
  const profile = loadProfile(id);
  expect(Object.keys(profile)).toEqual(["name", "email", "age"]);
})
```
- **Known defect:** shape-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` shape-only. Note: The keys can change and fail the test, but the field values pass unexamined. Case file [`checks/asserts/cases/result-keys/case.mjs`](checks/asserts/cases/result-keys/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Shape-not-value](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` no (0.08) · `asserts_written` yes (1.00) · `asserts_same` no (0.11) · `asserts_shape` yes (0.89) · `asserts_mock` no (0.01) → asserts: shape-only. **Escalates:** asserts shape-only.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `positive_a` yes (0.98) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` shape-only: match.
</details>
<details><summary><a id="case-86"></a>86. <code>planner returns roads</code> · shape-only · OK</summary>

```js
test("planner returns roads", () => {
  const roads = plan();
  expect(Array.isArray(roads)).toBe(true);
  expect(roads.length).toBe(3);
})
```
- **Known defect:** shape-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` shape-only. Note: shape-not-value: a shape change can fail it, the content is never checked. Case file [`checks/asserts/cases/shape-not-value/case.mjs`](checks/asserts/cases/shape-not-value/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Shape-not-value](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** unclassified, needs eyes.
  - `asserts_exact` yes (0.72) · `asserts_written` yes (1.00) · `asserts_same` no (0.18) · `asserts_shape` yes (0.99) · `asserts_mock` no (0.01). **Escalates:** asserts unstable (exact vs shape-only).
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `positive_a` yes (0.93) · `positive_b` yes (0.97) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` shape-only: not committed.
</details>
<details><summary><a id="case-87"></a>87. <code>returns a list of routes</code> · shape-only · OK</summary>

```js
test("returns a list of routes", () => {
  const routes = routesFor(graph);
  expect(Array.isArray(routes)).toBe(true);
})
```
- **Known defect:** shape-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` shape-only, `verdict` weak. Note: The array check can fail when the return type changes, but no route value is ever asserted. Case file [`checks/asserts/cases/result-array/case.mjs`](checks/asserts/cases/result-array/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Shape-not-value](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` no (0.12) · `asserts_written` yes (0.98) · `asserts_same` no (0.32) · `asserts_shape` yes (0.99) · `asserts_mock` no (0.01) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.21) · `positive_b` yes (0.84) → positive: unstable. **Escalates:** positive unstable (spread 0.63).
  - No escalation: `can_fail_a` yes (0.98) · `can_fail_c` yes (0.99) → can_fail: 0.99, spread 0.01 (stable). Label yes: match. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `asserts` shape-only: match · `verdict` weak: match.
</details>
<details><summary><a id="case-88"></a>88. <code>sorts by price ascending</code> · silent-failure · OK</summary>

```js
test("sorts by price ascending", () => {
  const sorted = sortByPrice([{ price: 3 }, { price: 1 }, { price: 2 }]);
  expect(JSON.stringify(sorted) === JSON.stringify([{ price: 1 }, { price: 2 }, { price: 3 }])).toBe(true);
})
```
- **Known defect:** silent-failure. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: A failure prints expected true, received false. Case file [`checks/verdict/cases/price-order/case.mjs`](checks/verdict/cases/price-order/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Assertion Roulette (Missing Assertion Message)](http://xunitpatterns.com/Assertion%20Roulette.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.28) · `asserts_shape` no (0.01) · `asserts_mock` no (0.00) → asserts: behaviour. `positive_a` yes (0.94) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-89"></a>89. <code>handles overflow</code> · skipped · OK</summary>

```js
test.skip("handles overflow", () => {
  expect(add(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER + 1);
})
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: skipped: the test never runs. Case file [`checks/runs/cases/skipped/case.mjs`](checks/runs/cases/skipped/case.mjs), line 5. Extractor notes: `skipped`. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` no (0.07) · `can_fail_c` no (0.04) → can_fail: 0.06, spread 0.03 (stable). **Escalates:** can_fail contradicts asserts.
  - runs: no, from the extractor's flags. **Escalates:** does not run, or narrows the run.
  - No escalation: `asserts_exact` yes (1.00) · `asserts_written` yes (0.98) · `asserts_same` no (0.36) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.98) · `positive_b` yes (0.99) → positive: yes.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-90"></a>90. <code>parses a dotted key</code> · skipped · OK</summary>

```js
xit("parses a dotted key", () => {
  expect(parseKey("a.b")).toEqual(["a", "b"]);
})
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: The test is marked xit, so it never runs. Case file [`checks/runs/cases/xit-key/case.mjs`](checks/runs/cases/xit-key/case.mjs), line 5. Extractor notes: `skipped`. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` no (0.18) · `can_fail_c` no (0.02) → can_fail: 0.10, spread 0.17 (stable). **Escalates:** can_fail contradicts asserts.
  - runs: no, from the extractor's flags. **Escalates:** does not run, or narrows the run.
  - No escalation: `asserts_exact` yes (0.99) · `asserts_written` yes (1.00) · `asserts_same` no (0.33) · `asserts_shape` no (0.03) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.97) · `positive_b` yes (0.98) → positive: yes.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-91"></a>91. <code>rejects a malformed header</code> · skipped · OK</summary>

```js
test.skip("rejects a malformed header", () => {
  expect(() => parseHeader("nope")).toThrow("missing colon");
})
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: The test is marked skip, so it never runs. Case file [`checks/runs/cases/header-pair/case.mjs`](checks/runs/cases/header-pair/case.mjs), line 4. Extractor notes: `skipped`. Sources: [testsmells.org, Open Catalog of Test Smells: Ignored Test](https://testsmells.org/pages/testsmells.html).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` no (0.11) · `can_fail_c` no (0.02) → can_fail: 0.07, spread 0.09 (stable). **Escalates:** can_fail contradicts asserts.
  - runs: no, from the extractor's flags. **Escalates:** does not run, or narrows the run.
  - No escalation: `asserts_exact` yes (0.92) · `asserts_written` yes (1.00) · `asserts_same` yes (0.56) · `asserts_shape` no (0.01) · `asserts_mock` no (0.03) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (0.78) → positive: yes.
- **Descriptive:** 5 clean · smells: `conditional` (conditional) · unanswered: none.
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-92"></a>92. <code>rejects a stale token</code> · skipped · OK</summary>

```js
test.skip("rejects a stale token", () => {
  expect(verifyToken("expired")).toBe(false);
})
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: The test is marked skipped, so it never runs. Case file [`checks/runs/cases/skip-token/case.mjs`](checks/runs/cases/skip-token/case.mjs), line 5. Extractor notes: `skipped`. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` no (0.05) · `can_fail_c` no (0.02) → can_fail: 0.03, spread 0.03 (stable). **Escalates:** can_fail contradicts asserts.
  - `positive_a` no (0.27) · `positive_b` yes (0.85) → positive: unstable. **Escalates:** positive unstable (spread 0.58).
  - runs: no, from the extractor's flags. **Escalates:** does not run, or narrows the run.
  - No escalation: `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.42) · `asserts_shape` no (0.02) · `asserts_mock` no (0.02) → asserts: behaviour.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-93"></a>93. <code>splits a dotted key</code> · skipped · OK</summary>

```js
test("splits a dotted key", () => {
    expect(parseKey("a.b")).toEqual(["a", "b"]);
  })
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: The describe around the test is skipped, so the test never runs. Case file [`checks/runs/cases/legacy-block/case.mjs`](checks/runs/cases/legacy-block/case.mjs), line 5, inside `describe.skip("legacy parser", () => {`. Extractor notes: `skipped`. Sources: [testsmells.org, Open Catalog of Test Smells: Ignored Test](https://testsmells.org/pages/testsmells.html).
- **What decided it:** unclassified, needs eyes.
  - `can_fail_a` yes (0.99) · `can_fail_c` no (0.21) → can_fail: 0.60, spread 0.78 (unstable). **Escalates:** can_fail unstable (spread 0.78).
  - runs: no, from the extractor's flags. **Escalates:** does not run, or narrows the run.
  - No escalation: `asserts_exact` yes (0.99) · `asserts_written` yes (1.00) · `asserts_same` no (0.27) · `asserts_shape` no (0.01) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-94"></a>94. <code>finds the largest prime below ten million</code> · slow · OK</summary>

```js
test("finds the largest prime below ten million", () => {
  expect(primesBelow(10_000_000).at(-1)).toBe(9_999_991);
})
```
- **Known defect:** slow. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: The sieve over ten million numbers is heavy work. Case file [`checks/verdict/cases/primes-ten-million/case.mjs`](checks/verdict/cases/primes-ten-million/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Fast](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.07) · `asserts_shape` no (0.00) · `asserts_mock` no (0.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-95"></a>95. <code>the package entry loads</code> · smoke · OK</summary>

```js
test("the package entry loads", async () => {
  await expect(import("../src/index.mjs")).resolves.toBeDefined();
})
```
- **Known defect:** smoke. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate, `can_fail` yes. Note: It checks only that something exists, so it is shape-only by nature and escalates. Case file [`checks/verdict/cases/module-loads/case.mjs`](checks/verdict/cases/module-loads/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy](http://xunitpatterns.com/).
- **What decided it:** unclassified, needs eyes.
  - `asserts_exact` no (0.09) · `asserts_written` yes (0.97) · `asserts_same` no (0.29) · `asserts_shape` no (0.39) · `asserts_mock` no (0.00). **Escalates:** asserts unstable (unsure shape 0.39).
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `positive_a` yes (0.91) · `positive_b` yes (0.89) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-96"></a>96. <code>reads the port from the environment</code> · state-leak · OK</summary>

```js
test("reads the port from the environment", () => {
  process.env.PORT = "8081";
  expect(portFromEnv()).toBe(8081);
})
```
- **Known defect:** state-leak. **Check:** [`restores`](checks/restores/check.mjs). **Expected:** pass, `can_fail` yes, `restores` no. Note: PORT stays 8081 for every later test. Case file [`checks/restores/cases/port-override/case.mjs`](checks/restores/cases/port-override/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Isolated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.13) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 4 clean · smells: `deterministic` (non-deterministic), `restores` (state-leak) · unanswered: none.
- **Label checks:** `restores` no: match.
</details>
<details><summary><a id="case-97"></a>97. <code>the reminder fires after an hour</code> · state-leak · OK</summary>

```js
test("the reminder fires after an hour", () => {
  vi.useFakeTimers();
  const fired = [];
  scheduleReminder(() => fired.push("reminder"), 3_600_000);
  vi.advanceTimersByTime(3_600_000);
  expect(fired).toEqual(["reminder"]);
})
```
- **Known defect:** state-leak. **Check:** [`restores`](checks/restores/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` yes, `restores` no. Note: The fake timers stay on for every later test. Case file [`checks/restores/cases/timer-left-fake/case.mjs`](checks/restores/cases/timer-left-fake/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Isolated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.23) · `asserts_shape` no (0.01) · `asserts_mock` no (0.05) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `restores` (state-leak) · unanswered: none.
- **Label checks:** `deterministic` yes: match · `restores` no: match.
</details>
<details><summary><a id="case-98"></a>98. <code>slugify lowercases through normalise</code> · structure-dependent · OK</summary>

```js
test("slugify lowercases through normalise", () => {
  const spy = vi.spyOn(internal, "normalise");
  expect(slugify("Hello World")).toBe("hello-world");
  expect(spy).toHaveBeenCalledWith("Hello World");
  spy.mockRestore();
})
```
- **Known defect:** structure-dependent. **Check:** [`resilient`](checks/resilient/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `resilient` no. Note: The spy pins an internal helper. The strongest assertion still checks the result. Case file [`checks/resilient/cases/slug-helper/case.mjs`](checks/resilient/cases/slug-helper/case.mjs), line 7. Sources: [Kent Beck, Test Desiderata (2019): Structure-insensitive](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.22) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.98) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `resilient` (structure-dependent) · unanswered: none.
- **Label checks:** `asserts` behaviour: match · `resilient` no: match.
</details>
<details><summary><a id="case-99"></a>99. <code>the build is green</code> · tautology · OK</summary>

```js
test("the build is green", () => {
  expect(true).toBe(true);
})
```
- **Known defect:** tautology. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no, `verdict` slop. Note: The assertion holds for every build, so breaking the code cannot fail it. Case file [`checks/can-fail/cases/constant-truth/case.mjs`](checks/can-fail/cases/constant-truth/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** unclassified, needs eyes.
  - `can_fail_a` no (0.02) · `can_fail_c` yes (0.98) → can_fail: 0.50, spread 0.96 (unstable). **Escalates:** can_fail unstable (spread 0.96). Label no: not scored.
  - No escalation: `asserts_exact` yes (1.00) · `asserts_written` yes (0.99) · `asserts_same` yes (0.84) · `asserts_shape` no (0.05) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.60) · `positive_b` yes (0.77) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `verdict` slop: not committed.
</details>
<details><summary><a id="case-100"></a>100. <code>the world is sane</code> · tautology · OK</summary>

```js
test("the world is sane", () => {
  expect(true).toBe(true);
})
```
- **Known defect:** tautology. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no, `verdict` slop. Note: tautology: true === true. Case file [`checks/can-fail/cases/tautology-constant/case.mjs`](checks/can-fail/cases/tautology-constant/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** unclassified, needs eyes.
  - `can_fail_a` no (0.03) · `can_fail_c` yes (1.00) → can_fail: 0.51, spread 0.97 (unstable). **Escalates:** can_fail unstable (spread 0.97). Label no: not scored.
  - No escalation: `asserts_exact` yes (1.00) · `asserts_written` yes (0.99) · `asserts_same` yes (0.86) · `asserts_shape` no (0.03) · `asserts_mock` no (0.00) → asserts: behaviour. `positive_a` yes (0.88) · `positive_b` yes (0.87) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `verdict` slop: not committed.
</details>
<details><summary><a id="case-101"></a>101. <code>reads the port from the sample file</code> · uncontrolled-resource · OK</summary>

```js
test("reads the port from the sample file", () => {
  const text = readFileSync("fixtures/sample.ini", "utf8");
  expect(parseIni(text).port).toBe(8080);
})
```
- **Known defect:** uncontrolled-resource. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: The file is assumed present; its content does not change between runs. Case file [`checks/verdict/cases/sample-ini/case.mjs`](checks/verdict/cases/sample-ini/case.mjs), line 6. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Resource Optimism (in Erratic Test)](http://xunitpatterns.com/Erratic%20Test.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.09) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-102"></a>102. <code>the summary is produced</code> · vacuous · OK</summary>

```js
test("the summary is produced", () => {
  const summary = summarise(rows);
  expect(summary.totals).toBeDefined();
})
```
- **Known defect:** vacuous. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` yes. Note: The aggregate exists, but no value inside it is ever read. Case file [`checks/can-fail/cases/aggregate-exists/case.mjs`](checks/can-fail/cases/aggregate-exists/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Vacuous / passes-with-zero](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` no (0.01) · `asserts_written` no (0.36) · `asserts_same` no (0.36) · `asserts_shape` yes (0.97) · `asserts_mock` no (0.01) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` yes (0.63) · `positive_b` no (0.29) → positive: borderline. **Escalates:** positive borderline (spread 0.34).
  - No escalation: `can_fail_a` yes (0.99) · `can_fail_c` yes (1.00) → can_fail: 0.99, spread 0.01 (stable). Label yes: match. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-103"></a>103. <code>works</code> · vague-name · OK</summary>

```js
test("works", () => {
  expect(parseNumber("42")).toBe(42);
})
```
- **Known defect:** vague-name. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes. Note: The name says nothing about the behaviour. Case file [`checks/verdict/cases/parse-digits/case.mjs`](checks/verdict/cases/parse-digits/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Obscure Test](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.20) · `asserts_shape` no (0.00) · `asserts_mock` no (0.01) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` yes (0.99) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-104"></a>104. <code>reads the major version</code> · weak-assert · OK</summary>

```js
test("reads the major version", () => {
  expect(parseVersion("1.2.3").major).toBeGreaterThan(0);
})
```
- **Known defect:** weak-assert. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** either, `can_fail` yes. Note: Any positive major passes. Escalation is welcome but not required. Case file [`checks/verdict/cases/major-bound/case.mjs`](checks/verdict/cases/major-bound/case.mjs), line 4. Sources: [Web Platform Tests, Review Checklist: "The test uses the most specific asserts possible"](https://web-platform-tests.org/reviewing-tests/checklist.html).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` no (0.27) · `asserts_written` yes (0.92) · `asserts_same` no (0.41) · `asserts_shape` no (0.02) · `asserts_mock` no (0.01) → asserts: inexact. **Escalates:** asserts inexact.
  - No escalation: `can_fail_a` yes (0.99) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.01 (stable). Label yes: match. `positive_a` yes (0.97) · `positive_b` yes (0.98) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-105"></a>105. <code>builds a job with the given name</code> · wrong-reason · OK</summary>

```js
test("builds a job with the given name", () => {
  const job = buildJob({ name: "nightly", steps: [] });
  expect(job.name).toBe("nightly");
})
```
Code under test, [`checks/verdict/cases/passthrough-argument/code.mjs`](checks/verdict/cases/passthrough-argument/code.mjs):

```js
export function buildJob({ name, steps }) {
  return { name, steps, status: "queued", createdAt: Date.now() };
}
```
- **Known defect:** wrong-reason. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** either, `can_fail` yes. Note: The asserted field is copied from the argument, so a stub that only copies would pass. Only the mutation check proves this, so escalation is welcome but not required. Case file [`checks/verdict/cases/passthrough-argument/case.mjs`](checks/verdict/cases/passthrough-argument/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Passes for the wrong reason](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.20) · `asserts_shape` no (0.00) · `asserts_mock` no (0.00) → asserts: behaviour. `positive_a` yes (0.98) · `positive_b` yes (1.00) → positive: yes. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
</details>
<details><summary><a id="case-106"></a>106. <code>reports no booking for a free slot</code> · wrong-reason · OK</summary>

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
- **Known defect:** wrong-reason. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** either, `can_fail` yes, `positive` no. Note: The lookup is empty only because the fixture never creates the booking it queries. Only the mutation check proves this, so escalation is welcome but not required. Case file [`checks/positive/cases/absent-record/case.mjs`](checks/positive/cases/absent-record/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Passes for the wrong reason](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` yes (1.00) · `asserts_written` yes (1.00) · `asserts_same` no (0.36) · `asserts_shape` no (0.47) · `asserts_mock` no (0.01). **Escalates:** asserts unstable (unsure same 0.36, shape 0.47).
  - `positive_a` no (0.00) · `positive_b` no (0.00) → positive: no. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. runs: yes, from the extractor's flags.
- **Descriptive:** 6 clean · smells: none · unanswered: none.
- **Label checks:** `positive` no: match.
</details>
<details><summary><a id="case-107"></a>107. <code>saves the user</code> · wrong-reason · OK</summary>

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
- **Known defect:** wrong-reason. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` interaction-only. Note: passes for the wrong reason: only the mock call is checked. Case file [`checks/asserts/cases/wrong-reason-mock/case.mjs`](checks/asserts/cases/wrong-reason-mock/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Passes for the wrong reason](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_exact` no (0.01) · `asserts_written` yes (0.73) · `asserts_same` no (0.39) · `asserts_shape` no (0.05) · `asserts_mock` yes (0.99) → asserts: interaction-only. **Escalates:** asserts interaction-only.
  - `positive_a` no (0.07) · `positive_b` no (0.09) → positive: no. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` yes (0.99) · `can_fail_c` yes (0.90) → can_fail: 0.94, spread 0.09 (stable). Label yes: match. runs: yes, from the extractor's flags.
- **Descriptive:** 5 clean · smells: `resilient` (structure-dependent) · unanswered: none.
- **Label checks:** `asserts` interaction-only: match.
</details>

## Legend

- **Case**: one labelled test in `checks/<check>/cases/<case>/`. `case.mjs` holds the test, `label.json` states the known defect and the expected outcome, and `code.mjs`, if the case has one, holds the code under test.
- **Check**: the check that the case is meant to catch, in `checks/<check>/check.mjs`. A mixed case, and a clean case that pins no single check, belong to the `verdict` check. A label can also name a check and the value it must give.
- **Escalate**: the tool sends the test to a human, so the test **needs eyes**. Each reason says why. A test with no reason **passes**.
- **can_fail**: the probability that a change to the code under test can make the test fail. The tool asks it in 2 phrasings and takes the mean. The **spread** is the highest value minus the lowest. A spread above `TEST_AUDIT_STABLE_BAND` makes the value borderline or unstable, and the test escalates.
- **Twin pair**: `positive` (`positive_a`, `positive_b`). The tool asks each twice, in two plain phrasings. The value counts only when both agree. A "no" escalates.
- **asserts**: what the assertion checks. Only `behaviour` is a real guard. `asserts_exact`, `asserts_written`, `asserts_same`, `asserts_shape`, `asserts_mock` each judge one property, and code picks the kind. Answers that contradict each other escalate.
- **runs**: read from the extractor's `skipped` and `focus-in-file` flags, not asked.
- **verdict**: slop, weak, good, computed from the answers, not asked: slop when the test cannot fail or takes its expected value from the code, weak when it checks no exact value, or only a shape, a mock call, or its input, or has no positive assertion. It adds no reason of its own.
- **Descriptive question**: a "no" is a **smell**. It raises the flag in brackets. It does not escalate the test.
- **Number in brackets**: for a yes/no question, the probability of yes. For a choice, the probability of the chosen option.
- **unanswered**: the endpoint gave no answer. **untrusted**: the answer has a `mass` below `TEST_AUDIT_MIN_MASS`. **not scored**: the tool did not commit to a can_fail value, so the agreement does not count the case.
- **Status** of a case:
  - **OK**: the outcome matches the label.
  - **SILENT pass**: a defect case did not escalate. Acceptance fails.
  - **MIXED not routed**: a mixed case did not escalate. Acceptance fails.
  - **FALSE positive**: a case that should pass escalated.
  - **WRONG can_fail**: the tool committed to the wrong can_fail value.
  - **WRONG check**: a check the label names committed to another value than the label. Not an acceptance rule.
  - **NO ANSWER**: the endpoint gave no trusted answer. Acceptance fails.
  - **NO TEST**: the case file holds no test with this name. Acceptance fails.

### Questions

The tool asks each test these questions in one call.

| Question | Asks | Answer |
| --- | --- | --- |
| `can_fail_a` | Can a bug in the behaviour this test names make the test fail? | yes: some bug in that behaviour fails it |
| `can_fail_c` | Does a wrong result of the named behaviour make this test fail? | yes: a wrong result makes it fail |
| `asserts_exact` | Does an assertion compare a result of the code with one exact value? | yes: it compares a result with one value, or with true or false |
| `asserts_written` | Does the test write the expected value as a literal or a calculation? | yes: the test writes the expected value |
| `asserts_same` | Do the expected value and the checked result come from the same code? | yes: they come from the same code, so they always agree |
| `asserts_shape` | Does each assertion check only the type, the size, or the keys of a result? | yes: only the type, the size, or the keys |
| `asserts_mock` | Does each assertion check only a call to a mock? | yes: only calls to a mock |
| `positive_a` | Does an assertion expect a non-empty value? | yes: a number, a string, true, an object, or an error message |
| `positive_b` | Does an assertion check a value that is not empty or null? | yes: it checks a real value |
| `conditional` | Does every assertion always run? | yes: no branch, loop, early return, or catch can skip or swallow one |
| `isolated` | Does this test pass alone and in any order? | yes: what it reads is built by it, a hook, or a fixture no test changes |
| `deterministic` | Does this test give the same result on every run? | yes: nothing real-time, random, networked, or external, or it is faked |
| `automated` | Does this test pass or fail with no person involved? | yes: no person must set up, act, or read |
| `restores` | Does this test leave all shared state as it found it? | yes: it changes none, or an after hook puts it back |
| `resilient` | Does this test use only the public interface of the code? | yes: a public import, and it asserts a return, a throw, or an effect a caller sees |
