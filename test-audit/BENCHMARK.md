# test-audit benchmark

Date: 2026-10-07. Command:

```sh
TEST_AUDIT_CONCURRENCY=3 TEST_AUDIT_TIMEOUT_MS=600000 node cli.mjs --selftest --benchmark \
  --targets "http://koishi.tail6defbc.ts.net:8090|qwen3.8-flash-next-mtp"
```

> The run took 88m38s on llama-arbiter branch `systemone-speed`: the old prompt layout (rubric, state, one full question), the rubric-start cache, and the template fix. The run before these changes took 95m56s on the same corpus.
> The run predates one relabel: `asserts/cases/mock-argument` now has `canFail` yes, so the WRONG can_fail on `forwards the payload` below is the old label, not the model.
> Node's `fetch` stops at 300 s for a response, whatever `TEST_AUDIT_TIMEOUT_MS` says.

This file records a calibration run of `test-audit` over the labelled corpus. Each case is one test with a known defect, or a clean test. The [legend](#legend) explains the terms.

## Summary: qwen3.8-flash-next-mtp

Endpoint `http://koishi.tail6defbc.ts.net:8090`, model `qwen3.8-flash-next-mtp`. 107 cases, 107 calls, 155257 tokens.

| Measure | Result | Meaning |
| --- | --- | --- |
| Cases | 107 | The labelled tests in the corpus. |
| Silent passes | 0 | Defect cases that did not escalate. Must be 0. |
| False positives | 1 of 58 | Cases that should pass, but escalated. Lower is better. |
| can_fail agreement | 85 of 87 (98%) | The can_fail answers that match the label. Only the cases where the tool committed to a value count. Must be 90% or more. |
| Mixed routed | 5 of 5 | Mixed cases that escalated. Must be all. |
| Check agreement | 186 of 189 | The check values that match the label, where the label names one and the tool committed. Not an acceptance rule. The table below splits it by check. |
| Unresolved | 0 | Cases with no test or no answer. Must be 0. |
| Acceptance | **PASS** | PASS when each "must" in this table holds. |

### Defect families

| Family | Cases | Escalated | Expected | OK |
| --- | --- | --- | --- | --- |
| ambiguous | 5 | 5 | escalate | yes |
| clean | 37 | 0 | pass | yes |
| commented-out | 2 | 2 | escalate | yes |
| conditional-logic | 1 | 0 | pass | yes |
| eager | 2 | 0 | pass | **no**: 1 WRONG check |
| early-return | 1 | 1 | escalate | yes |
| focused | 2 | 2 | escalate | yes |
| general-fixture | 1 | 0 | pass | yes |
| hardcoded-data | 2 | 2 | escalate | yes |
| implementation-coupled | 1 | 0 | either | yes |
| interaction-only | 3 | 3 | escalate | **no**: 1 WRONG can_fail |
| magic-number | 1 | 0 | pass | yes |
| manual | 1 | 1 | pass | **no**: 1 FALSE positive |
| name-only | 4 | 4 | escalate | yes |
| non-deterministic | 6 | 0 | 5 pass, 1 either | **no**: 1 WRONG check |
| obscure | 1 | 0 | pass | yes |
| only-negative | 4 | 4 | escalate | **no**: 1 WRONG can_fail |
| order-dependent | 1 | 0 | pass | yes |
| passes-with-zero | 2 | 2 | escalate | yes |
| self-reference | 3 | 3 | escalate | yes |
| shape-only | 4 | 4 | escalate | yes |
| silent-failure | 1 | 0 | pass | yes |
| skipped | 5 | 5 | escalate | yes |
| slow | 1 | 0 | pass | yes |
| smoke | 1 | 1 | escalate | yes |
| state-leak | 3 | 0 | pass | **no**: 1 WRONG check |
| structure-dependent | 1 | 0 | pass | yes |
| tautology | 2 | 2 | escalate | yes |
| uncontrolled-resource | 1 | 0 | pass | yes |
| vacuous | 2 | 2 | escalate | yes |
| vague-name | 1 | 0 | pass | yes |
| weak-assert | 1 | 1 | either | yes |
| wrong-reason | 4 | 3 | 2 escalate, 2 either | yes |

### Check agreement

| Check | Labelled | Committed | Match |
| --- | --- | --- | --- |
| `asserts` | 28 | 27 | 27 (100%) |
| `positive` | 19 | 19 | 19 (100%) |
| `runs` | 20 | 20 | 20 (100%) |
| `type` | 15 | 15 | 15 (100%) |
| `observable` | 9 | 9 | 9 (100%) |
| `conditional` | 3 | 3 | 3 (100%) |
| `isolated` | 3 | 3 | 3 (100%) |
| `controlled` | 3 | 3 | 3 (100%) |
| `specific` | 2 | 2 | 2 (100%) |
| `named` | 9 | 9 | 9 (100%) |
| `deterministic` | 17 | 17 | 16 (94%) |
| `one_thing` | 10 | 10 | 9 (90%) |
| `name_matches` | 11 | 11 | 11 (100%) |
| `resilient` | 2 | 2 | 2 (100%) |
| `diagnostic` | 2 | 2 | 2 (100%) |
| `fixture` | 2 | 2 | 2 (100%) |
| `fast` | 3 | 3 | 3 (100%) |
| `readable` | 2 | 2 | 2 (100%) |
| `magic_number` | 2 | 2 | 2 (100%) |
| `reads_output` | 8 | 8 | 8 (100%) |
| `automated` | 2 | 2 | 2 (100%) |
| `restores` | 5 | 5 | 4 (80%) |
| `verdict` | 13 | 13 | 13 (100%) |

**Not OK:** [1. `creating a user validates, stores and notifies`](#case-1) WRONG check · [2. `forwards the payload`](#case-2) WRONG can_fail · [3. `accepts the token from the mail`](#case-3) FALSE positive · [4. `the token has not expired yet`](#case-4) WRONG check · [5. `parses a well formed header`](#case-5) WRONG can_fail · [6. `registers a handler`](#case-6) WRONG check.

## Cases at a glance: qwen3.8-flash-next-mtp

The cases that are not OK come first, then the others by defect family. A test name links to its details.

| # | Test | Check | Known defect | Expected | Result | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [`creating a user validates, stores and notifies`](#case-1) | [`one-thing`](checks/one-thing/check.mjs) | eager | pass | good, passes | **WRONG check** |
| 2 | [`forwards the payload`](#case-2) | [`asserts`](checks/asserts/check.mjs) | interaction-only | escalate | weak, needs eyes | **WRONG can_fail** |
| 3 | [`accepts the token from the mail`](#case-3) | [`automated`](checks/automated/check.mjs) | manual | pass | weak, needs eyes | **FALSE positive** |
| 4 | [`the token has not expired yet`](#case-4) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | good, passes | **WRONG check** |
| 5 | [`parses a well formed header`](#case-5) | [`positive`](checks/positive/check.mjs) | only-negative | escalate | weak, needs eyes | **WRONG can_fail** |
| 6 | [`registers a handler`](#case-6) | [`isolated`](checks/isolated/check.mjs) | state-leak | pass | strong, passes | **WRONG check** |
| 7 | [`builds the graph`](#case-7) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate | weak, needs eyes | OK |
| 8 | [`collects the graph nodes`](#case-8) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate | weak, needs eyes | OK |
| 9 | [`retries once`](#case-9) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate | weak, needs eyes | OK |
| 10 | [`the schema is sound`](#case-10) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate | weak, needs eyes | OK |
| 11 | [`the world is sane`](#case-11) | [`verdict`](checks/verdict/check.mjs) | ambiguous | escalate | slop, needs eyes | OK |
| 12 | [`a new job starts queued with no steps`](#case-12) | [`one-thing`](checks/one-thing/check.mjs) | clean | pass | strong, passes | OK |
| 13 | [`a seeded shuffle gives a fixed order`](#case-13) | [`deterministic`](checks/deterministic/check.mjs) | clean | pass | strong, passes | OK |
| 14 | [`a token expires after its time to live`](#case-14) | [`controlled`](checks/controlled/check.mjs) | clean | pass | strong, passes | OK |
| 15 | [`add handles negatives`](#case-15) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 16 | [`adds two numbers`](#case-16) | [`type`](checks/type/check.mjs) | clean | pass | strong, passes | OK |
| 17 | [`an invoice falls due thirty days after it is issued`](#case-17) | [`magic-number`](checks/magic-number/check.mjs) | clean | pass | strong, passes | OK |
| 18 | [`capitalises a lower case name`](#case-18) | [`readable`](checks/readable/check.mjs) | clean | pass | strong, passes | OK |
| 19 | [`capitalises the first letter`](#case-19) | [`conditional`](checks/conditional/check.mjs) | clean | pass | strong, passes | OK |
| 20 | [`converts minutes to seconds`](#case-20) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 21 | [`counts the words in a sentence`](#case-21) | [`isolated`](checks/isolated/check.mjs) | clean | pass | strong, passes | OK |
| 22 | [`debounce fires once after the wait`](#case-22) | [`deterministic`](checks/deterministic/check.mjs) | clean | pass | strong, passes | OK |
| 23 | [`finds the imports of a file`](#case-23) | [`positive`](checks/positive/check.mjs) | clean | pass | strong, passes | OK |
| 24 | [`formats a date as ISO`](#case-24) | [`automated`](checks/automated/check.mjs) | clean | pass | strong, passes | OK |
| 25 | [`formats a receipt line`](#case-25) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 26 | [`joins two path parts with a slash`](#case-26) | [`observable`](checks/observable/check.mjs) | clean | pass | strong, passes | OK |
| 27 | [`orders the scores from low to high`](#case-27) | [`asserts`](checks/asserts/check.mjs) | clean | pass | strong, passes | OK |
| 28 | [`parses a number`](#case-28) | [`named`](checks/named/check.mjs) | clean | pass | strong, passes | OK |
| 29 | [`parses a semantic version`](#case-29) | [`asserts`](checks/asserts/check.mjs) | clean | pass | strong, passes | OK |
| 30 | [`parses a well formed header`](#case-30) | [`runs`](checks/runs/check.mjs) | clean | pass | strong, passes | OK |
| 31 | [`pins the current receipt layout before the rewrite`](#case-31) | [`type`](checks/type/check.mjs) | clean | pass | strong, passes | OK |
| 32 | [`reads the port from the environment`](#case-32) | [`restores`](checks/restores/check.mjs) | clean | pass | strong, passes | OK |
| 33 | [`regression #12: an empty list sums to zero`](#case-33) | [`type`](checks/type/check.mjs) | clean | pass | strong, passes | OK |
| 34 | [`regression #42: a single import resolves`](#case-34) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 35 | [`regression #77: a trimmed name keeps its inner spaces`](#case-35) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 36 | [`rejects a header without a colon`](#case-36) | [`positive`](checks/positive/check.mjs) | clean | pass | strong, passes | OK |
| 37 | [`removes duplicate tags`](#case-37) | [`resilient`](checks/resilient/check.mjs) | clean | pass | strong, passes | OK |
| 38 | [`reverses a string`](#case-38) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 39 | [`rounds to two decimals`](#case-39) | [`fast`](checks/fast/check.mjs) | clean | pass | strong, passes | OK |
| 40 | [`slugs a display name`](#case-40) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 41 | [`splits a version into its parts`](#case-41) | [`specific`](checks/specific/check.mjs) | clean | pass | strong, passes | OK |
| 42 | [`store round trips a value`](#case-42) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 43 | [`takes ten percent off the total`](#case-43) | [`fixture`](checks/fixture/check.mjs) | clean | pass | strong, passes | OK |
| 44 | [`the cache returns a stored value`](#case-44) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 45 | [`the server answers health`](#case-45) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 46 | [`the service reports its version`](#case-46) | [`verdict`](checks/verdict/check.mjs) | clean | pass | strong, passes | OK |
| 47 | [`the store keeps a value on disk`](#case-47) | [`type`](checks/type/check.mjs) | clean | pass | strong, passes | OK |
| 48 | [`totals the cart`](#case-48) | [`diagnostic`](checks/diagnostic/check.mjs) | clean | pass | strong, passes | OK |
| 49 | [`merges the options`](#case-49) | [`asserts`](checks/asserts/check.mjs) | commented-out | escalate | slop, needs eyes | OK |
| 50 | [`parses config`](#case-50) | [`asserts`](checks/asserts/check.mjs) | commented-out | escalate | slop, needs eyes | OK |
| 51 | [`every row is validated`](#case-51) | [`conditional`](checks/conditional/check.mjs) | conditional-logic | pass | good, passes | OK |
| 52 | [`the pipeline parses, formats and lints`](#case-52) | [`one-thing`](checks/one-thing/check.mjs) | eager | pass | strong, passes | OK |
| 53 | [`rejects a blank name`](#case-53) | [`conditional`](checks/conditional/check.mjs) | early-return | escalate | slop, needs eyes | OK |
| 54 | [`loads the draft`](#case-54) | [`runs`](checks/runs/check.mjs) | focused | escalate | weak, needs eyes | OK |
| 55 | [`saves the draft`](#case-55) | [`runs`](checks/runs/check.mjs) | focused | escalate | strong, needs eyes | OK |
| 56 | [`slugs the tenant name`](#case-56) | [`fixture`](checks/fixture/check.mjs) | general-fixture | pass | strong, passes | OK |
| 57 | [`resolves the status labels`](#case-57) | [`asserts`](checks/asserts/check.mjs) | hardcoded-data | escalate | slop, needs eyes | OK |
| 58 | [`taxes the standard rate`](#case-58) | [`asserts`](checks/asserts/check.mjs) | hardcoded-data | escalate | slop, needs eyes | OK |
| 59 | [`indexes both words`](#case-59) | [`observable`](checks/observable/check.mjs) | implementation-coupled | either | strong, passes | OK |
| 60 | [`notifies the listener`](#case-60) | [`asserts`](checks/asserts/check.mjs) | interaction-only | escalate | weak, needs eyes | OK |
| 61 | [`publishes twice`](#case-61) | [`asserts`](checks/asserts/check.mjs) | interaction-only | escalate | weak, needs eyes | OK |
| 62 | [`maps a paid, unshipped order to its status code`](#case-62) | [`magic-number`](checks/magic-number/check.mjs) | magic-number | pass | strong, passes | OK |
| 63 | [`computes the tax`](#case-63) | [`name-matches`](checks/name-matches/check.mjs) | name-only | escalate | weak, needs eyes | OK |
| 64 | [`computes the tax due`](#case-64) | [`name-matches`](checks/name-matches/check.mjs) | name-only | escalate | weak, needs eyes | OK |
| 65 | [`sorts rows by name`](#case-65) | [`name-matches`](checks/name-matches/check.mjs) | name-only | escalate | weak, needs eyes | OK |
| 66 | [`validates email addresses`](#case-66) | [`name-matches`](checks/name-matches/check.mjs) | name-only | escalate | weak, needs eyes | OK |
| 67 | [`both jobs report in start order`](#case-67) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | strong, passes | OK |
| 68 | [`debounce fires once`](#case-68) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | either | strong, passes | OK |
| 69 | [`the remote catalogue lists the widget`](#case-69) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | good, passes | OK |
| 70 | [`the retry lands within the window`](#case-70) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | strong, passes | OK |
| 71 | [`the sorter keeps every random value`](#case-71) | [`deterministic`](checks/deterministic/check.mjs) | non-deterministic | pass | strong, passes | OK |
| 72 | [`resolves the route of a request`](#case-72) | [`readable`](checks/readable/check.mjs) | obscure | pass | strong, passes | OK |
| 73 | [`finds no imports in an empty file`](#case-73) | [`positive`](checks/positive/check.mjs) | only-negative | escalate | strong, needs eyes | OK |
| 74 | [`no edge for a comment`](#case-74) | [`positive`](checks/positive/check.mjs) | only-negative | escalate | good, needs eyes | OK |
| 75 | [`returns null for an unknown setting`](#case-75) | [`positive`](checks/positive/check.mjs) | only-negative | escalate | good, needs eyes | OK |
| 76 | [`dispatches to the registered handler`](#case-76) | [`isolated`](checks/isolated/check.mjs) | order-dependent | pass | strong, passes | OK |
| 77 | [`events are dispatched`](#case-77) | [`can-fail`](checks/can-fail/check.mjs) | passes-with-zero | escalate | slop, needs eyes | OK |
| 78 | [`imports are folded`](#case-78) | [`can-fail`](checks/can-fail/check.mjs) | passes-with-zero | escalate | weak, needs eyes | OK |
| 79 | [`parse is stable`](#case-79) | [`can-fail`](checks/can-fail/check.mjs) | self-reference | escalate | slop, needs eyes | OK |
| 80 | [`reader round trips`](#case-80) | [`can-fail`](checks/can-fail/check.mjs) | self-reference | escalate | slop, needs eyes | OK |
| 81 | [`the two totals match`](#case-81) | [`can-fail`](checks/can-fail/check.mjs) | self-reference | escalate | slop, needs eyes | OK |
| 82 | [`builds three steps`](#case-82) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | weak, needs eyes | OK |
| 83 | [`loads the profile fields`](#case-83) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | strong, needs eyes | OK |
| 84 | [`planner returns roads`](#case-84) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | weak, needs eyes | OK |
| 85 | [`returns a list of routes`](#case-85) | [`asserts`](checks/asserts/check.mjs) | shape-only | escalate | weak, needs eyes | OK |
| 86 | [`sorts by price ascending`](#case-86) | [`diagnostic`](checks/diagnostic/check.mjs) | silent-failure | pass | strong, passes | OK |
| 87 | [`handles overflow`](#case-87) | [`runs`](checks/runs/check.mjs) | skipped | escalate | good, needs eyes | OK |
| 88 | [`parses a dotted key`](#case-88) | [`runs`](checks/runs/check.mjs) | skipped | escalate | strong, needs eyes | OK |
| 89 | [`rejects a malformed header`](#case-89) | [`runs`](checks/runs/check.mjs) | skipped | escalate | strong, needs eyes | OK |
| 90 | [`rejects a stale token`](#case-90) | [`runs`](checks/runs/check.mjs) | skipped | escalate | good, needs eyes | OK |
| 91 | [`splits a dotted key`](#case-91) | [`runs`](checks/runs/check.mjs) | skipped | escalate | strong, needs eyes | OK |
| 92 | [`finds the largest prime below ten million`](#case-92) | [`fast`](checks/fast/check.mjs) | slow | pass | strong, passes | OK |
| 93 | [`the package entry loads`](#case-93) | [`type`](checks/type/check.mjs) | smoke | escalate | weak, needs eyes | OK |
| 94 | [`reads the port from the environment`](#case-94) | [`restores`](checks/restores/check.mjs) | state-leak | pass | strong, passes | OK |
| 95 | [`the reminder fires after an hour`](#case-95) | [`restores`](checks/restores/check.mjs) | state-leak | pass | strong, passes | OK |
| 96 | [`slugify lowercases through normalise`](#case-96) | [`resilient`](checks/resilient/check.mjs) | structure-dependent | pass | strong, passes | OK |
| 97 | [`the build is green`](#case-97) | [`can-fail`](checks/can-fail/check.mjs) | tautology | escalate | slop, needs eyes | OK |
| 98 | [`the world is sane`](#case-98) | [`can-fail`](checks/can-fail/check.mjs) | tautology | escalate | slop, needs eyes | OK |
| 99 | [`reads the port from the sample file`](#case-99) | [`controlled`](checks/controlled/check.mjs) | uncontrolled-resource | pass | strong, passes | OK |
| 100 | [`the queue is not negative`](#case-100) | [`can-fail`](checks/can-fail/check.mjs) | vacuous | escalate | weak, needs eyes | OK |
| 101 | [`the summary is produced`](#case-101) | [`can-fail`](checks/can-fail/check.mjs) | vacuous | escalate | weak, needs eyes | OK |
| 102 | [`works`](#case-102) | [`named`](checks/named/check.mjs) | vague-name | pass | strong, passes | OK |
| 103 | [`reads the major version`](#case-103) | [`specific`](checks/specific/check.mjs) | weak-assert | either | weak, needs eyes | OK |
| 104 | [`builds a job with the given name`](#case-104) | [`reads-output`](checks/reads-output/check.mjs) | wrong-reason | either | strong, passes | OK |
| 105 | [`normalise trims the title`](#case-105) | [`reads-output`](checks/reads-output/check.mjs) | wrong-reason | escalate | weak, needs eyes | OK |
| 106 | [`reports no booking for a free slot`](#case-106) | [`positive`](checks/positive/check.mjs) | wrong-reason | either | weak, needs eyes | OK |
| 107 | [`saves the user`](#case-107) | [`asserts`](checks/asserts/check.mjs) | wrong-reason | escalate | weak, needs eyes | OK |

## Case details: qwen3.8-flash-next-mtp

Click a case to open it. The cases that are not OK are open.

<details open><summary><a id="case-1"></a>1. <code>creating a user validates, stores and notifies</code> · eager · <b>WRONG check</b></summary>

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
- **Known defect:** eager. **Check:** [`one-thing`](checks/one-thing/check.mjs). **Expected:** pass, `can_fail` yes, `one_thing` no. Note: A real user-creation check, but validation, storage and notification are three unrelated behaviours. Case file [`checks/one-thing/cases/unrelated/case.mjs`](checks/one-thing/cases/unrelated/case.mjs), line 5. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Eager Test (in Obscure Test)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (0.98) · `asserts_b` behaviour (0.89) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` good (2.40).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (0.68).
- **Label checks:** **`one_thing` no, tool yes**.
</details>
<details open><summary><a id="case-2"></a>2. <code>forwards the payload</code> · interaction-only · <b>WRONG can_fail</b></summary>

```js
test("forwards the payload", () => {
  const spy = mock(send);
  dispatch(message);
  expect(spy.mock.calls[0][0]).toMatchObject({ id: expect.any(String) });
})
```
- **Known defect:** interaction-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` no, `asserts` interaction-only. Note: The mock argument shape can change and fail the test, while the real output stays unchecked. Case file [`checks/asserts/cases/mock-argument/case.mjs`](checks/asserts/cases/mock-argument/case.mjs), line 4. Sources: [Martin Fowler, Mocks Aren't Stubs (2007)](https://martinfowler.com/articles/mocksArentStubs.html).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` yes (0.77) · `can_fail_b` no (0.03) · `can_fail_c` yes (0.81) → can_fail: 0.85, spread 0.20 (stable). **WRONG can_fail:** label no, tool 0.85.
  - `asserts_a` interaction-only (0.50) · `asserts_b` shape-only (0.61) → asserts: unstable. **Escalates:** asserts unstable (interaction-only vs shape-only).
  - `verdict` weak (1.02). **Escalates:** verdict weak.
  - No escalation: `positive_a` yes (0.92) · `positive_b` no (0.03) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 14 clean · smells: `specific` (weak-assert), `fixture` (general-fixture), `readable` (obscure), `restores` (state-leak) · unanswered: none · `type` unit (0.99).
- **Label checks:** `asserts` interaction-only: not committed.
</details>
<details open><summary><a id="case-3"></a>3. <code>accepts the token from the mail</code> · manual · <b>FALSE positive</b></summary>

```js
test("accepts the token from the mail", async () => {
  const token = await readLine("paste the token from the mail: ");
  expect(verifyToken(token)).toBe(true);
})
```
- **Known defect:** manual. **Check:** [`automated`](checks/automated/check.mjs). **Expected:** pass, `can_fail` yes, `automated` no. Note: A person must act before the assertion can run. Case file [`checks/automated/cases/pasted-token/case.mjs`](checks/automated/cases/pasted-token/case.mjs), line 6. Sources: [Kent Beck, Test Desiderata (2019): Automated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` yes (0.80) · `can_fail_b` no (0.49) · `can_fail_c` no (0.07) → can_fail: 0.46, spread 0.73 (unstable). **Escalates:** can_fail unstable (spread 0.73). Label yes: not scored.
  - `verdict` weak (0.86). **Escalates:** verdict weak.
  - No escalation: `asserts_a` behaviour (0.97) · `asserts_b` behaviour (0.73) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.01) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 10 clean · smells: `isolated` (order-dependent), `controlled` (uncontrolled-resource), `deterministic` (non-deterministic), `name_matches` (name-mismatch), `fixture` (general-fixture), `fast` (slow), `readable` (obscure), `automated` (manual) · unanswered: none · `type` e2e (0.69).
- **Label checks:** `automated` no: match.
</details>
<details open><summary><a id="case-4"></a>4. <code>the token has not expired yet</code> · non-deterministic · <b>WRONG check</b></summary>

```js
test("the token has not expired yet", () => {
  const token = issueToken({ ttlMs: 60_000 });
  expect(token.expiresAt).toBeGreaterThan(Date.now());
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no. Note: A real expiry check, but reading Date.now makes the result depend on when the test runs. Case file [`checks/deterministic/cases/clock/case.mjs`](checks/deterministic/cases/clock/case.mjs), line 5. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (0.96) · `can_fail_b` no (0.01) · `can_fail_c` yes (0.98) → can_fail: 0.98, spread 0.03 (stable). Label yes: match. `asserts_a` behaviour (0.90) · `asserts_b` behaviour (0.75) → asserts: behaviour. `positive_a` yes (0.79) · `positive_b` no (0.01) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` good (1.82).
- **Descriptive:** 15 clean · smells: `controlled` (uncontrolled-resource), `specific` (weak-assert), `readable` (obscure) · unanswered: none · `type` unit (0.99).
- **Label checks:** **`deterministic` no, tool yes**.
</details>
<details open><summary><a id="case-5"></a>5. <code>parses a well formed header</code> · only-negative · <b>WRONG can_fail</b></summary>

```js
test("parses a well formed header", () => {
  const run = () => parseHeader("content-length: 12");
  expect(run).not.toThrow();
})
```
- **Known defect:** only-negative. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate, `can_fail` yes, `positive` no. Note: Only that the call does not throw is checked, and the parsed output is never asserted. Case file [`checks/positive/cases/no-throw/case.mjs`](checks/positive/cases/no-throw/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` no (0.07) · `can_fail_b` yes (0.98) · `can_fail_c` no (0.02) → can_fail: 0.04, spread 0.05 (stable). **WRONG can_fail:** label yes, tool 0.04.
  - `asserts_a` nothing (1.00) · `asserts_b` nothing (1.00) → asserts: nothing. **Escalates:** asserts nothing.
  - `positive_a` no (0.00) · `positive_b` yes (1.00) → positive: no. **Escalates:** no positive assertion.
  - `verdict` weak (0.99). **Escalates:** verdict weak.
  - No escalation: `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 13 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `diagnostic` (silent-failure), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` smoke (0.68).
- **Label checks:** `positive` no: match.
</details>
<details open><summary><a id="case-6"></a>6. <code>registers a handler</code> · state-leak · <b>WRONG check</b></summary>

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
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `isolated` yes: match · **`restores` no, tool yes**.
</details>
<details><summary><a id="case-7"></a>7. <code>builds the graph</code> · ambiguous · OK</summary>

```js
test("builds the graph", () => {
  const graph = build();
  expect(Array.isArray(graph.nodes)).toBe(true);
  expect(graph.nodes.length).toBeGreaterThan(0);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: two shape assertions. Case file [`checks/verdict/cases/mixed-shape/case.mjs`](checks/verdict/cases/mixed-shape/case.mjs), line 5. Sources: [Xuezhi Wang et al., Self-Consistency Improves Chain of Thought Reasoning (ICLR 2023)](https://arxiv.org/abs/2203.11171).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` yes (0.85) · `can_fail_b` no (0.07) · `can_fail_c` yes (0.55) → can_fail: 0.77, spread 0.37 (borderline). **Escalates:** can_fail borderline (spread 0.37).
  - `asserts_a` shape-only (1.00) · `asserts_b` shape-only (1.00) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.09) · `positive_b` no (0.15) → positive: unstable. **Escalates:** positive unstable (spread 0.76).
  - `verdict` weak (1.00). **Escalates:** verdict weak.
  - No escalation: `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 14 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `fixture` (general-fixture), `readable` (obscure) · unanswered: none · `type` smoke (0.79).
</details>
<details><summary><a id="case-8"></a>8. <code>collects the graph nodes</code> · ambiguous · OK</summary>

```js
test("collects the graph nodes", () => {
  const nodes = collect(graph);
  expect(Array.isArray(nodes)).toBe(true);
  expect(nodes.length).toBeGreaterThan(0);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: Both assertions check the shape and never the node values, so the paraphrased gates disagree. Case file [`checks/verdict/cases/mixed-graph-shapes/case.mjs`](checks/verdict/cases/mixed-graph-shapes/case.mjs), line 5. Sources: [Xuezhi Wang et al., Self-Consistency Improves Chain of Thought Reasoning (ICLR 2023)](https://arxiv.org/abs/2203.11171).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` yes (0.87) · `can_fail_b` no (0.19) · `can_fail_c` no (0.27) → can_fail: 0.65, spread 0.60 (unstable). **Escalates:** can_fail unstable (spread 0.60).
  - `asserts_a` shape-only (1.00) · `asserts_b` shape-only (1.00) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.13) · `positive_b` no (0.17) → positive: unstable. **Escalates:** positive unstable (spread 0.69).
  - `verdict` weak (1.00). **Escalates:** verdict weak.
  - No escalation: `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 13 clean · smells: `isolated` (order-dependent), `specific` (weak-assert), `name_matches` (name-mismatch), `fixture` (general-fixture), `readable` (obscure) · unanswered: none · `type` smoke (0.54).
</details>
<details><summary><a id="case-9"></a>9. <code>retries once</code> · ambiguous · OK</summary>

```js
test("retries once", () => {
  const fn = mock(flakyOperation);
  retry(fn);
  expect(fn).toHaveBeenCalledTimes(2);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: interaction assertion with a specific count. Case file [`checks/verdict/cases/mixed-mock/case.mjs`](checks/verdict/cases/mixed-mock/case.mjs), line 5. Sources: [Xuezhi Wang et al., Self-Consistency Improves Chain of Thought Reasoning (ICLR 2023)](https://arxiv.org/abs/2203.11171).
- **What decided it:** weak, needs eyes.
  - `asserts_a` interaction-only (1.00) · `asserts_b` interaction-only (1.00) → asserts: interaction-only. **Escalates:** asserts interaction-only.
  - `verdict` weak (1.26). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` yes (0.95) · `can_fail_b` no (0.05) · `can_fail_c` yes (0.98) → can_fail: 0.96, spread 0.04 (stable). `positive_a` yes (0.73) · `positive_b` no (0.03) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 16 clean · smells: `observable` (implementation-coupled), `readable` (obscure) · unanswered: none · `type` unit (0.99).
</details>
<details><summary><a id="case-10"></a>10. <code>the schema is sound</code> · ambiguous · OK</summary>

```js
test("the schema is sound", () => {
  expect(true).toBe(true);
  expect(schema.fields.length).toBeGreaterThan(0);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: A tautology sits beside a weak shape assertion, so the paraphrased gates disagree. Case file [`checks/verdict/cases/mixed-world-shape/case.mjs`](checks/verdict/cases/mixed-world-shape/case.mjs), line 5. Sources: [Xuezhi Wang et al., Self-Consistency Improves Chain of Thought Reasoning (ICLR 2023)](https://arxiv.org/abs/2203.11171).
- **What decided it:** weak, needs eyes.
  - `asserts_a` shape-only (0.95) · `asserts_b` shape-only (0.96) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.13) · `positive_b` no (0.17) → positive: unstable. **Escalates:** positive unstable (spread 0.70).
  - `verdict` weak (0.97). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` no (0.09) · `can_fail_b` yes (0.75) · `can_fail_c` no (0.01) → can_fail: 0.12, spread 0.23 (stable). `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 12 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `fixture` (general-fixture), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` smoke (0.95).
</details>
<details><summary><a id="case-11"></a>11. <code>the world is sane</code> · ambiguous · OK</summary>

```js
test("the world is sane", () => {
  expect(true).toBe(true);
  expect(add.length).toBeGreaterThan(0);
})
```
- **Known defect:** ambiguous. It is a mixed case, so its answers can disagree. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** escalate. Note: half tautology, half weak shape assertion. Case file [`checks/verdict/cases/mixed-tautology/case.mjs`](checks/verdict/cases/mixed-tautology/case.mjs), line 5. Sources: [Xuezhi Wang et al., Self-Consistency Improves Chain of Thought Reasoning (ICLR 2023)](https://arxiv.org/abs/2203.11171).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing (0.65) · `asserts_b` nothing (0.89) → asserts: nothing. **Escalates:** asserts nothing.
  - `positive_a` no (0.16) · `positive_b` no (0.18) → positive: unstable. **Escalates:** positive unstable (spread 0.66).
  - `verdict` slop (0.03). **Escalates:** verdict slop.
  - No escalation: `can_fail_a` no (0.01) · `can_fail_b` yes (0.98) · `can_fail_c` no (0.00) → can_fail: 0.01, spread 0.02 (stable). `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 10 clean · smells: `observable` (implementation-coupled), `specific` (weak-assert), `named` (vague-name), `one_thing` (eager), `name_matches` (name-mismatch), `fixture` (general-fixture), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` smoke (0.78).
</details>
<details><summary><a id="case-12"></a>12. <code>a new job starts queued with no steps</code> · clean · OK</summary>

```js
test("a new job starts queued with no steps", () => {
  expect(buildJob({ name: "nightly" })).toEqual({ name: "nightly", status: "queued", steps: [] });
})
```
- **Known defect:** none, a clean test. **Check:** [`one-thing`](checks/one-thing/check.mjs). **Expected:** pass, `can_fail` yes, `one_thing` yes. Note: One action, one result. Case file [`checks/one-thing/cases/one-result-many-fields/case.mjs`](checks/one-thing/cases/one-result-many-fields/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Eager Test (in Obscure Test and Assertion Roulette)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (0.98) · `positive_b` no (0.03) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `one_thing` yes: match.
</details>
<details><summary><a id="case-13"></a>13. <code>a seeded shuffle gives a fixed order</code> · clean · OK</summary>

```js
test("a seeded shuffle gives a fixed order", () => {
  const rng = seededRandom(42);
  expect(shuffle([1, 2, 3, 4], rng)).toEqual([3, 1, 4, 2]);
})
```
- **Known defect:** none, a clean test. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` yes. Note: The randomness is seeded. Case file [`checks/deterministic/cases/seeded-shuffle/case.mjs`](checks/deterministic/cases/seeded-shuffle/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (0.99).
- **Label checks:** `deterministic` yes: match.
</details>
<details><summary><a id="case-14"></a>14. <code>a token expires after its time to live</code> · clean · OK</summary>

```js
test("a token expires after its time to live", () => {
  const token = issueToken({ ttlMs: 500, now: () => 1_000 });
  expect(token.expiresAt).toBe(1_500);
})
```
- **Known defect:** none, a clean test. **Check:** [`controlled`](checks/controlled/check.mjs). **Expected:** pass, `can_fail` yes, `controlled` yes, `deterministic` yes. Note: The clock is injected, so it is controlled and deterministic. Case file [`checks/controlled/cases/ttl-expiry/case.mjs`](checks/controlled/cases/ttl-expiry/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Resource Optimism (in Erratic Test)](http://xunitpatterns.com/Erratic%20Test.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `controlled` yes: match · `deterministic` yes: match.
</details>
<details><summary><a id="case-15"></a>15. <code>add handles negatives</code> · clean · OK</summary>

```js
test("add handles negatives", () => {
  expect(add(-2, -3)).toBe(-5);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `type` unit, `observable` yes, `named` yes, `deterministic` yes, `one_thing` yes, `name_matches` yes, `reads_output` yes, `verdict` strong. Note: a clean unit guard. Case file [`checks/verdict/cases/good-unit-add/case.mjs`](checks/verdict/cases/good-unit-add/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `type` unit: match · `observable` yes: match · `named` yes: match · `deterministic` yes: match · `one_thing` yes: match · `name_matches` yes: match · `reads_output` yes: match · `verdict` strong: match.
</details>
<details><summary><a id="case-16"></a>16. <code>adds two numbers</code> · clean · OK</summary>

```js
test("adds two numbers", () => {
  expect(add(2, 3)).toBe(5);
})
```
- **Known defect:** none, a clean test. **Check:** [`type`](checks/type/check.mjs). **Expected:** pass, `can_fail` yes, `type` unit. Note: One small unit in isolation. Case file [`checks/type/cases/pure-add/case.mjs`](checks/type/cases/pure-add/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy](http://xunitpatterns.com/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `type` unit: match.
</details>
<details><summary><a id="case-17"></a>17. <code>an invoice falls due thirty days after it is issued</code> · clean · OK</summary>

```js
test("an invoice falls due thirty days after it is issued", () => {
  const DUE_IN_DAYS = 30;
  expect(dueDate("2026-01-01", DUE_IN_DAYS)).toBe("2026-01-31");
})
```
- **Known defect:** none, a clean test. **Check:** [`magic-number`](checks/magic-number/check.mjs). **Expected:** pass, `can_fail` yes, `magic_number` yes. Note: The expected date follows from the input and the named constant. Case file [`checks/magic-number/cases/due-date/case.mjs`](checks/magic-number/cases/due-date/case.mjs), line 5. Sources: [testsmells.org, Open Catalog of Test Smells: Magic Number Test](https://testsmells.org/pages/testsmells.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `magic_number` yes: match.
</details>
<details><summary><a id="case-18"></a>18. <code>capitalises a lower case name</code> · clean · OK</summary>

```js
test("capitalises a lower case name", () => {
  expect(capitalise("ada")).toBe("Ada");
})
```
- **Known defect:** none, a clean test. **Check:** [`readable`](checks/readable/check.mjs). **Expected:** pass, `can_fail` yes, `readable` yes. Note: Everything is visible. Case file [`checks/readable/cases/first-letter/case.mjs`](checks/readable/cases/first-letter/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Readable](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `readable` yes: match.
</details>
<details><summary><a id="case-19"></a>19. <code>capitalises the first letter</code> · clean · OK</summary>

```js
test("capitalises the first letter", () => {
  expect(capitalise("ada")).toBe("Ada");
})
```
- **Known defect:** none, a clean test. **Check:** [`conditional`](checks/conditional/check.mjs). **Expected:** pass, `can_fail` yes, `conditional` yes. Note: No branch, loop, or catch. Case file [`checks/conditional/cases/straight-line/case.mjs`](checks/conditional/cases/straight-line/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Conditional Test Logic](http://xunitpatterns.com/Conditional%20Test%20Logic.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `conditional` yes: match.
</details>
<details><summary><a id="case-20"></a>20. <code>converts minutes to seconds</code> · clean · OK</summary>

```js
test("converts minutes to seconds", () => {
  expect(toSeconds(3)).toBe(180);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `type` unit, `observable` yes, `named` yes, `deterministic` yes, `one_thing` yes, `name_matches` yes, `reads_output` yes, `verdict` strong. Note: a real guard. Case file [`checks/verdict/cases/good-unit-seconds/case.mjs`](checks/verdict/cases/good-unit-seconds/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `type` unit: match · `observable` yes: match · `named` yes: match · `deterministic` yes: match · `one_thing` yes: match · `name_matches` yes: match · `reads_output` yes: match · `verdict` strong: match.
</details>
<details><summary><a id="case-21"></a>21. <code>counts the words in a sentence</code> · clean · OK</summary>

```js
test("counts the words in a sentence", () => {
  expect(wordCount("a b c")).toBe(3);
})
```
- **Known defect:** none, a clean test. **Check:** [`isolated`](checks/isolated/check.mjs). **Expected:** pass, `can_fail` yes, `isolated` yes. Note: No shared state. Case file [`checks/isolated/cases/word-count/case.mjs`](checks/isolated/cases/word-count/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Isolated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `isolated` yes: match.
</details>
<details><summary><a id="case-22"></a>22. <code>debounce fires once after the wait</code> · clean · OK</summary>

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
- **Known defect:** none, a clean test. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` yes, `fast` yes, `restores` yes. Note: The timers are faked and restored. Case file [`checks/deterministic/cases/debounce-wait/case.mjs`](checks/deterministic/cases/debounce-wait/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.01) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `deterministic` yes: match · `fast` yes: match · `restores` yes: match.
</details>
<details><summary><a id="case-23"></a>23. <code>finds the imports of a file</code> · clean · OK</summary>

```js
test("finds the imports of a file", () => {
  expect(findImports("")).toEqual([]);
  expect(findImports('import a from "b";')).toEqual([{ name: "a", from: "b" }]);
})
```
- **Known defect:** none, a clean test. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** pass, `can_fail` yes, `positive` yes. Note: One assertion names a value that must be produced, beside the empty case. Case file [`checks/positive/cases/import-pair/case.mjs`](checks/positive/cases/import-pair/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `positive` yes: match.
</details>
<details><summary><a id="case-24"></a>24. <code>formats a date as ISO</code> · clean · OK</summary>

```js
test("formats a date as ISO", () => {
  expect(formatDate(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05");
})
```
- **Known defect:** none, a clean test. **Check:** [`automated`](checks/automated/check.mjs). **Expected:** pass, `can_fail` yes, `automated` yes. Note: No person needed. Case file [`checks/automated/cases/iso-date/case.mjs`](checks/automated/cases/iso-date/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Automated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `automated` yes: match.
</details>
<details><summary><a id="case-25"></a>25. <code>formats a receipt line</code> · clean · OK</summary>

```js
test("formats a receipt line", () => {
  expect(formatReceiptLine("Coffee", 2, 3.5)).toBe("Coffee x2 @ 3.50 = 7.00");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `observable` yes, `named` yes, `deterministic` yes, `one_thing` yes, `name_matches` yes, `reads_output` yes, `verdict` strong. Note: a real guard. Case file [`checks/verdict/cases/good-characterization-receipt/case.mjs`](checks/verdict/cases/good-characterization-receipt/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `observable` yes: match · `named` yes: match · `deterministic` yes: match · `one_thing` yes: match · `name_matches` yes: match · `reads_output` yes: match · `verdict` strong: match.
</details>
<details><summary><a id="case-26"></a>26. <code>joins two path parts with a slash</code> · clean · OK</summary>

```js
test("joins two path parts with a slash", () => {
  expect(joinPath(["a", "b"])).toBe("a/b");
})
```
- **Known defect:** none, a clean test. **Check:** [`observable`](checks/observable/check.mjs). **Expected:** pass, `can_fail` yes, `observable` yes. Note: The return value is observable. Case file [`checks/observable/cases/path-join/case.mjs`](checks/observable/cases/path-join/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Indirect Testing (in Obscure Test)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `observable` yes: match.
</details>
<details><summary><a id="case-27"></a>27. <code>orders the scores from low to high</code> · clean · OK</summary>

```js
test("orders the scores from low to high", () => {
  const scores = [7, 3, 9, 1];
  const expected = [...scores].sort((a, b) => a - b);
  expect(rank(scores)).toEqual(expected);
})
```
- **Known defect:** none, a clean test. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour. Note: The oracle is computed in the test from its own input, without the code under test. Case file [`checks/asserts/cases/sorted-copy/case.mjs`](checks/asserts/cases/sorted-copy/case.mjs), line 4. Sources: [testsmells.org, Open Catalog of Test Smells: Redundant Assertion](https://testsmells.org/pages/testsmells.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (0.98) · `can_fail_b` no (0.02) · `can_fail_c` yes (1.00) → can_fail: 0.99, spread 0.02 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (0.98) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.97).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (0.99).
- **Label checks:** `asserts` behaviour: match.
</details>
<details><summary><a id="case-28"></a>28. <code>parses a number</code> · clean · OK</summary>

```js
test("parses a number", () => {
  expect(parseNumber("42")).toBe(42);
})
```
- **Known defect:** none, a clean test. **Check:** [`named`](checks/named/check.mjs). **Expected:** pass, `can_fail` yes, `named` yes. Note: The name says which behaviour the test checks. Case file [`checks/named/cases/string-to-int/case.mjs`](checks/named/cases/string-to-int/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Obscure Test](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `named` yes: match.
</details>
<details><summary><a id="case-29"></a>29. <code>parses a semantic version</code> · clean · OK</summary>

```js
test("parses a semantic version", () => {
  expect(parseVersion("1.2.3")).toEqual(EXPECTED);
})
```

Setup:

```js
const EXPECTED = { major: 1, minor: 2, patch: 3 };
```
- **Known defect:** none, a clean test. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `verdict` strong. Note: The expected value is a constant the test file declares, so the assertion checks behaviour. Case file [`checks/asserts/cases/named-expected/case.mjs`](checks/asserts/cases/named-expected/case.mjs), line 7. Sources: [testsmells.org, Open Catalog of Test Smells: Magic Number Test](https://testsmells.org/pages/testsmells.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `verdict` strong: match.
</details>
<details><summary><a id="case-30"></a>30. <code>parses a well formed header</code> · clean · OK</summary>

```js
test("parses a well formed header", () => {
  expect(parseHeader("content-length: 12")).toEqual({ "content-length": "12" });
})
```
- **Known defect:** none, a clean test. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** pass, `can_fail` yes, `runs` yes. Note: A skip on a sibling does not stop this test, and it narrows nothing. Case file [`checks/runs/cases/header-pair/case.mjs`](checks/runs/cases/header-pair/case.mjs), line 8. Sources: [testsmells.org, Open Catalog of Test Smells: Ignored Test](https://testsmells.org/pages/testsmells.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `runs` yes: match.
</details>
<details><summary><a id="case-31"></a>31. <code>pins the current receipt layout before the rewrite</code> · clean · OK</summary>

```js
test("pins the current receipt layout before the rewrite", () => {
  const order = { lines: [{ name: "Coffee", qty: 2, price: 3.5 }] };
  expect(renderReceipt(order)).toMatchInlineSnapshot(`"Coffee x2 @ 3.50 = 7.00"`);
})
```
- **Known defect:** none, a clean test. **Check:** [`type`](checks/type/check.mjs). **Expected:** pass, `can_fail` yes, `type` characterization. Note: The name and the inline snapshot say it pins today's output. Case file [`checks/type/cases/receipt-baseline/case.mjs`](checks/type/cases/receipt-baseline/case.mjs), line 5. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy](http://xunitpatterns.com/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` characterization (1.00).
- **Label checks:** `type` characterization: match.
</details>
<details><summary><a id="case-32"></a>32. <code>reads the port from the environment</code> · clean · OK</summary>

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
- **Known defect:** none, a clean test. **Check:** [`restores`](checks/restores/check.mjs). **Expected:** pass, `can_fail` yes, `controlled` yes, `restores` yes. Note: The afterEach restores PORT. Case file [`checks/restores/cases/env-port/case.mjs`](checks/restores/cases/env-port/case.mjs), line 11. Sources: [Kent Beck, Test Desiderata (2019): Isolated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `controlled` yes: match · `restores` yes: match.
</details>
<details><summary><a id="case-33"></a>33. <code>regression #12: an empty list sums to zero</code> · clean · OK</summary>

```js
test("regression #12: an empty list sums to zero", () => {
  expect(sum([])).toBe(0);
})
```
- **Known defect:** none, a clean test. **Check:** [`type`](checks/type/check.mjs). **Expected:** pass, `can_fail` yes, `type` regression. Note: The name cites a past issue. Case file [`checks/type/cases/issue-cited/case.mjs`](checks/type/cases/issue-cited/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy](http://xunitpatterns.com/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` no (0.01) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` regression (1.00).
- **Label checks:** `type` regression: match.
</details>
<details><summary><a id="case-34"></a>34. <code>regression #42: a single import resolves</code> · clean · OK</summary>

```js
test("regression #42: a single import resolves", () => {
  expect(parseImports('import a from "b";')).toEqual([{ name: "a", from: "b" }]);
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `type` regression, `observable` yes, `named` yes, `deterministic` yes, `one_thing` yes, `name_matches` yes, `reads_output` yes, `verdict` strong. Note: a clean regression guard. Case file [`checks/verdict/cases/good-regression/case.mjs`](checks/verdict/cases/good-regression/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` regression (1.00).
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `type` regression: match · `observable` yes: match · `named` yes: match · `deterministic` yes: match · `one_thing` yes: match · `name_matches` yes: match · `reads_output` yes: match · `verdict` strong: match.
</details>
<details><summary><a id="case-35"></a>35. <code>regression #77: a trimmed name keeps its inner spaces</code> · clean · OK</summary>

```js
test("regression #77: a trimmed name keeps its inner spaces", () => {
  expect(trimName("  Ada  Lovelace  ")).toBe("Ada  Lovelace");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `type` regression, `observable` yes, `named` yes, `deterministic` yes, `one_thing` yes, `name_matches` yes, `reads_output` yes, `verdict` strong. Note: a real guard. Case file [`checks/verdict/cases/good-regression-whitespace/case.mjs`](checks/verdict/cases/good-regression-whitespace/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` regression (1.00).
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `type` regression: match · `observable` yes: match · `named` yes: match · `deterministic` yes: match · `one_thing` yes: match · `name_matches` yes: match · `reads_output` yes: match · `verdict` strong: match.
</details>
<details><summary><a id="case-36"></a>36. <code>rejects a header without a colon</code> · clean · OK</summary>

```js
test("rejects a header without a colon", () => {
  expect(() => parseHeader("content-length 12")).toThrow("missing colon");
})
```
- **Known defect:** none, a clean test. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** pass, `can_fail` yes, `positive` yes. Note: A thrown error with its message is a positive assertion, not a mere non-throw. Case file [`checks/positive/cases/header-error/case.mjs`](checks/positive/cases/header-error/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `positive` yes: match.
</details>
<details><summary><a id="case-37"></a>37. <code>removes duplicate tags</code> · clean · OK</summary>

```js
test("removes duplicate tags", () => {
  expect(dedupe(["a", "b", "a"])).toEqual(["a", "b"]);
})
```
- **Known defect:** none, a clean test. **Check:** [`resilient`](checks/resilient/check.mjs). **Expected:** pass, `can_fail` yes, `resilient` yes. Note: Public interface, result only. Case file [`checks/resilient/cases/tag-dedupe/case.mjs`](checks/resilient/cases/tag-dedupe/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Structure-insensitive](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `resilient` yes: match.
</details>
<details><summary><a id="case-38"></a>38. <code>reverses a string</code> · clean · OK</summary>

```js
test("reverses a string", () => {
  expect(reverse("abc")).toBe("cba");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `type` unit, `observable` yes, `named` yes, `deterministic` yes, `one_thing` yes, `name_matches` yes, `reads_output` yes, `verdict` strong. Note: a clean unit guard. Case file [`checks/verdict/cases/good-unit-reverse/case.mjs`](checks/verdict/cases/good-unit-reverse/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `type` unit: match · `observable` yes: match · `named` yes: match · `deterministic` yes: match · `one_thing` yes: match · `name_matches` yes: match · `reads_output` yes: match · `verdict` strong: match.
</details>
<details><summary><a id="case-39"></a>39. <code>rounds to two decimals</code> · clean · OK</summary>

```js
test("rounds to two decimals", () => {
  expect(round2(3.14159)).toBe(3.14);
})
```
- **Known defect:** none, a clean test. **Check:** [`fast`](checks/fast/check.mjs). **Expected:** pass, `can_fail` yes, `fast` yes. Note: Milliseconds. Case file [`checks/fast/cases/two-decimals/case.mjs`](checks/fast/cases/two-decimals/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Fast](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `fast` yes: match.
</details>
<details><summary><a id="case-40"></a>40. <code>slugs a display name</code> · clean · OK</summary>

```js
test("slugs a display name", () => {
  expect(slugify("Hello, World")).toBe("hello-world");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `type` unit, `observable` yes, `named` yes, `deterministic` yes, `one_thing` yes, `name_matches` yes, `reads_output` yes, `verdict` strong. Note: a real guard. Case file [`checks/verdict/cases/good-unit-slug/case.mjs`](checks/verdict/cases/good-unit-slug/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `type` unit: match · `observable` yes: match · `named` yes: match · `deterministic` yes: match · `one_thing` yes: match · `name_matches` yes: match · `reads_output` yes: match · `verdict` strong: match.
</details>
<details><summary><a id="case-41"></a>41. <code>splits a version into its parts</code> · clean · OK</summary>

```js
test("splits a version into its parts", () => {
  expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
})
```
- **Known defect:** none, a clean test. **Check:** [`specific`](checks/specific/check.mjs). **Expected:** pass, `can_fail` yes, `specific` yes. Note: toEqual on the whole value. Case file [`checks/specific/cases/semver-parts/case.mjs`](checks/specific/cases/semver-parts/case.mjs), line 4. Sources: [Web Platform Tests, Review Checklist: "The test uses the most specific asserts possible"](https://web-platform-tests.org/reviewing-tests/checklist.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `specific` yes: match.
</details>
<details><summary><a id="case-42"></a>42. <code>store round trips a value</code> · clean · OK</summary>

```js
test("store round trips a value", async () => {
  const store = await openStore(tmpdir());
  await store.set("k", "v");
  expect(await store.get("k")).toBe("v");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `type` integration. Note: a clean integration guard. Case file [`checks/verdict/cases/good-integration/case.mjs`](checks/verdict/cases/good-integration/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.97).
- **Descriptive:** 17 clean · smells: `fast` (slow) · unanswered: none · `type` integration (0.99).
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `type` integration: match.
</details>
<details><summary><a id="case-43"></a>43. <code>takes ten percent off the total</code> · clean · OK</summary>

```js
test("takes ten percent off the total", () => {
  const cart = { items: [{ price: 100 }] };
  expect(applyDiscount(cart, 10).total).toBe(90);
})
```
- **Known defect:** none, a clean test. **Check:** [`fixture`](checks/fixture/check.mjs). **Expected:** pass, `can_fail` yes, `fixture` yes. Note: A minimal local fixture. Case file [`checks/fixture/cases/percent-discount/case.mjs`](checks/fixture/cases/percent-discount/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): General Fixture, Irrelevant Information (in Obscure Test)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `fixture` yes: match.
</details>
<details><summary><a id="case-44"></a>44. <code>the cache returns a stored value</code> · clean · OK</summary>

```js
test("the cache returns a stored value", async () => {
  const cache = await openCache(tmpdir());
  await cache.put("session", "abc123");
  expect(await cache.get("session")).toBe("abc123");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `type` integration. Note: a real guard. Case file [`checks/verdict/cases/good-integration-cache/case.mjs`](checks/verdict/cases/good-integration-cache/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 17 clean · smells: `fast` (slow) · unanswered: none · `type` integration (0.99).
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `type` integration: match.
</details>
<details><summary><a id="case-45"></a>45. <code>the server answers health</code> · clean · OK</summary>

```js
test("the server answers health", async () => {
  const res = await fetch(base + "/health");
  expect(await res.text()).toBe("ok");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `type` e2e. Note: a clean end-to-end guard. Case file [`checks/verdict/cases/good-e2e/case.mjs`](checks/verdict/cases/good-e2e/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 13 clean · smells: `controlled` (uncontrolled-resource), `deterministic` (non-deterministic), `fixture` (general-fixture), `fast` (slow), `readable` (obscure) · unanswered: none · `type` e2e (0.78).
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `type` e2e: match.
</details>
<details><summary><a id="case-46"></a>46. <code>the service reports its version</code> · clean · OK</summary>

```js
test("the service reports its version", async () => {
  const res = await fetch(base + "/version");
  expect(await res.text()).toBe("2.4.1");
})
```
- **Known defect:** none, a clean test. **Check:** [`verdict`](checks/verdict/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `positive` yes, `runs` yes, `type` e2e. Note: a real guard. Case file [`checks/verdict/cases/good-e2e-version/case.mjs`](checks/verdict/cases/good-e2e-version/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Behavioral, Specific](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 14 clean · smells: `controlled` (uncontrolled-resource), `deterministic` (non-deterministic), `fixture` (general-fixture), `fast` (slow) · unanswered: none · `type` e2e (0.85).
- **Label checks:** `asserts` behaviour: match · `positive` yes: match · `runs` yes: match · `type` e2e: match.
</details>
<details><summary><a id="case-47"></a>47. <code>the store keeps a value on disk</code> · clean · OK</summary>

```js
test("the store keeps a value on disk", async () => {
  const store = await openStore(await mkdtemp(join(tmpdir(), "store-")));
  await store.set("k", "v");
  expect(await store.get("k")).toBe("v");
})
```
- **Known defect:** none, a clean test. **Check:** [`type`](checks/type/check.mjs). **Expected:** pass, `can_fail` yes, `type` integration. Note: The code runs with a real filesystem. Case file [`checks/type/cases/disk-store/case.mjs`](checks/type/cases/disk-store/case.mjs), line 8. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy](http://xunitpatterns.com/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 17 clean · smells: `fast` (slow) · unanswered: none · `type` integration (1.00).
- **Label checks:** `type` integration: match.
</details>
<details><summary><a id="case-48"></a>48. <code>totals the cart</code> · clean · OK</summary>

```js
test("totals the cart", () => {
  expect(cartTotal([{ price: 2, qty: 3 }, { price: 1, qty: 1 }])).toBe(7);
})
```
- **Known defect:** none, a clean test. **Check:** [`diagnostic`](checks/diagnostic/check.mjs). **Expected:** pass, `can_fail` yes, `diagnostic` yes. Note: toBe shows both values on failure. Case file [`checks/diagnostic/cases/cart-total/case.mjs`](checks/diagnostic/cases/cart-total/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Assertion Roulette (Missing Assertion Message)](http://xunitpatterns.com/Assertion%20Roulette.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `diagnostic` yes: match.
</details>
<details><summary><a id="case-49"></a>49. <code>merges the options</code> · commented-out · OK</summary>

```js
test("merges the options", () => {
  // expect(mergeOptions({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  expect(true).toBe(true);
})
```
- **Known defect:** commented-out. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` no, `asserts` nothing. Note: The real assertion is commented out, beside a tautology. Case file [`checks/asserts/cases/commented-out-merge/case.mjs`](checks/asserts/cases/commented-out-merge/case.mjs), line 9. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md); [Web Platform Tests, Review Checklist: "The test does not contain commented-out code"](https://web-platform-tests.org/reviewing-tests/checklist.html).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing (1.00) · `asserts_b` nothing (1.00) → asserts: nothing. **Escalates:** asserts nothing.
  - `positive_a` no (0.03) · `positive_b` yes (0.68) → positive: borderline. **Escalates:** positive borderline (spread 0.29).
  - `verdict` slop (0.00). **Escalates:** verdict slop.
  - No escalation: `can_fail_a` no (0.00) · `can_fail_b` yes (1.00) · `can_fail_c` no (0.00) → can_fail: 0.00, spread 0.00 (stable). Label no: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 13 clean · smells: `observable` (implementation-coupled), `specific` (weak-assert), `name_matches` (name-mismatch), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` unit (0.83).
- **Label checks:** `asserts` nothing: match.
</details>
<details><summary><a id="case-50"></a>50. <code>parses config</code> · commented-out · OK</summary>

```js
test("parses config", () => {
  // expect(parseConfig("a=1")).toEqual({ a: "1" });
  expect(true).toBe(true);
})
```
- **Known defect:** commented-out. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `asserts` nothing. Note: commented-out assertion beside a tautology. Case file [`checks/asserts/cases/commented-out/case.mjs`](checks/asserts/cases/commented-out/case.mjs), line 8. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md); [Web Platform Tests, Review Checklist: "The test does not contain commented-out code"](https://web-platform-tests.org/reviewing-tests/checklist.html).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing (1.00) · `asserts_b` nothing (1.00) → asserts: nothing. **Escalates:** asserts nothing.
  - `positive_a` no (0.01) · `positive_b` yes (0.76) → positive: no. **Escalates:** no positive assertion.
  - `verdict` slop (0.00). **Escalates:** verdict slop.
  - No escalation: `can_fail_a` no (0.00) · `can_fail_b` yes (1.00) · `can_fail_c` no (0.00) → can_fail: 0.00, spread 0.00 (stable). `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 14 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` unit (0.65).
- **Label checks:** `asserts` nothing: match.
</details>
<details><summary><a id="case-51"></a>51. <code>every row is validated</code> · conditional-logic · OK</summary>

```js
test("every row is validated", () => {
  const rows = validateAll([{ id: 1 }, { id: 2 }]);
  for (const row of rows) expect(row.valid).toBe(true);
})
```
- **Known defect:** conditional-logic. **Check:** [`conditional`](checks/conditional/check.mjs). **Expected:** pass, `can_fail` yes, `conditional` no. Note: If validateAll returns an empty list, the loop asserts nothing. Case file [`checks/conditional/cases/row-loop/case.mjs`](checks/conditional/cases/row-loop/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Conditional Test Logic](http://xunitpatterns.com/Conditional%20Test%20Logic.html).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (0.92) · `can_fail_b` no (0.01) · `can_fail_c` yes (0.96) → can_fail: 0.96, spread 0.06 (stable). Label yes: match. `asserts_a` behaviour (0.99) · `asserts_b` behaviour (0.96) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` good (1.93).
- **Descriptive:** 17 clean · smells: `conditional` (conditional) · unanswered: none · `type` unit (0.99).
- **Label checks:** `conditional` no: match.
</details>
<details><summary><a id="case-52"></a>52. <code>the pipeline parses, formats and lints</code> · eager · OK</summary>

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
- **Known defect:** eager. **Check:** [`one-thing`](checks/one-thing/check.mjs). **Expected:** pass, `can_fail` yes, `one_thing` no. Note: A real pipeline check, but parse, format and lint are three features asserted in one body. Case file [`checks/one-thing/cases/three-features/case.mjs`](checks/one-thing/cases/three-features/case.mjs), line 5. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Eager Test (in Obscure Test)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 17 clean · smells: `one_thing` (eager) · unanswered: none · `type` integration (0.97).
- **Label checks:** `one_thing` no: match.
</details>
<details><summary><a id="case-53"></a>53. <code>rejects a blank name</code> · early-return · OK</summary>

```js
test("rejects a blank name", () => {
  return;
  expect(validateName("")).toBe(false);
})
```
- **Known defect:** early-return. **Check:** [`conditional`](checks/conditional/check.mjs). **Expected:** escalate, `can_fail` no, `conditional` no. Note: The early return makes the assertion unreachable, so the test cannot fail. Case file [`checks/conditional/cases/early-return-name/case.mjs`](checks/conditional/cases/early-return-name/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing (0.98) · `asserts_b` nothing (0.99) → asserts: nothing. **Escalates:** asserts nothing.
  - `verdict` slop (0.04). **Escalates:** verdict slop.
  - No escalation: `can_fail_a` no (0.01) · `can_fail_b` yes (1.00) · `can_fail_c` no (0.00) → can_fail: 0.00, spread 0.00 (stable). Label no: match. `positive_a` yes (0.87) · `positive_b` no (0.14) → positive: yes. `runs_a` yes (0.53) · `runs_b` no (0.47) → runs: yes.
- **Descriptive:** 15 clean · smells: `conditional` (conditional), `name_matches` (name-mismatch), `fixture` (general-fixture) · unanswered: none · `type` unit (0.95).
- **Label checks:** `conditional` no: match.
</details>
<details><summary><a id="case-54"></a>54. <code>loads the draft</code> · focused · OK</summary>

```js
it("loads the draft", () => {
  expect(loadDraft("draft")).toEqual("draft");
})
```
- **Known defect:** focused. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: The plain test inherits the file-level focus from it.only. Case file [`checks/runs/cases/focus-draft/case.mjs`](checks/runs/cases/focus-draft/case.mjs), line 10. Extractor notes: `focus-in-file`. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` yes (0.74) · `can_fail_b` no (0.29) · `can_fail_c` no (0.41) → can_fail: 0.62, spread 0.33 (borderline). **Escalates:** can_fail borderline (spread 0.33).
  - `asserts_a` behaviour (0.50) · `asserts_b` input-only (0.47) → asserts: unstable. **Escalates:** asserts unstable (behaviour vs input-only).
  - `runs_a` no (0.00) · `runs_b` yes (1.00) → runs: no. **Escalates:** does not run, or narrows the run.
  - `verdict` weak (1.06). **Escalates:** verdict weak.
  - No escalation: `positive_a` yes (0.97) · `positive_b` no (0.01) → positive: yes.
- **Descriptive:** 17 clean · smells: `fixture` (general-fixture) · unanswered: none · `type` unit (0.93).
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-55"></a>55. <code>saves the draft</code> · focused · OK</summary>

```js
it.only("saves the draft", () => {
  expect(saveDraft("draft")).toBe(true);
})
```
- **Known defect:** focused. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: The it.only focuses the file and narrows the whole run. Case file [`checks/runs/cases/focus-draft/case.mjs`](checks/runs/cases/focus-draft/case.mjs), line 6. Extractor notes: `focus-in-file`. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** strong, needs eyes.
  - `runs_a` no (0.00) · `runs_b` yes (1.00) → runs: no. **Escalates:** does not run, or narrows the run.
  - No escalation: `can_fail_a` yes (0.99) · `can_fail_b` no (0.00) · `can_fail_c` yes (0.98) → can_fail: 0.99, spread 0.02 (stable). `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `verdict` strong (2.90).
- **Descriptive:** 17 clean · smells: `fixture` (general-fixture) · unanswered: none · `type` unit (0.99).
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-56"></a>56. <code>slugs the tenant name</code> · general-fixture · OK</summary>

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
- **Known defect:** general-fixture. **Check:** [`fixture`](checks/fixture/check.mjs). **Expected:** pass, `can_fail` yes, `fixture` no. Note: Only the name matters; the rest of the fixture is irrelevant. Case file [`checks/fixture/cases/tenant-slug/case.mjs`](checks/fixture/cases/tenant-slug/case.mjs), line 17. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): General Fixture, Irrelevant Information (in Obscure Test)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 16 clean · smells: `fixture` (general-fixture), `readable` (obscure) · unanswered: none · `type` unit (0.99).
- **Label checks:** `fixture` no: match.
</details>
<details><summary><a id="case-57"></a>57. <code>resolves the status labels</code> · hardcoded-data · OK</summary>

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
- **Known defect:** hardcoded-data. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` no, `asserts` hardcoded-data. Note: The expected value is the code under test own constant, so the test agrees by construction and cannot fail. Case file [`checks/asserts/cases/status-table/case.mjs`](checks/asserts/cases/status-table/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_a` hardcoded-data (1.00) · `asserts_b` hardcoded-data (1.00) → asserts: hardcoded-data. **Escalates:** asserts hardcoded-data.
  - `verdict` slop (0.09). **Escalates:** verdict slop.
  - No escalation: `can_fail_a` no (0.25) · `can_fail_b` yes (0.76) · `can_fail_c` no (0.14) → can_fail: 0.21, spread 0.11 (stable). Label no: match. `positive_a` yes (0.84) · `positive_b` no (0.01) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 17 clean · smells: `readable` (obscure) · unanswered: none · `type` unit (0.96).
- **Label checks:** `asserts` hardcoded-data: match.
</details>
<details><summary><a id="case-58"></a>58. <code>taxes the standard rate</code> · hardcoded-data · OK</summary>

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
- **Known defect:** hardcoded-data. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` no, `asserts` hardcoded-data. Note: The expected value is the code under test own constant, so the test agrees by construction and cannot fail. Case file [`checks/asserts/cases/constant-copy/case.mjs`](checks/asserts/cases/constant-copy/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `can_fail_a` yes (0.58) · `can_fail_b` yes (0.91) · `can_fail_c` no (0.17) → can_fail: 0.28, spread 0.48 (borderline). **Escalates:** can_fail borderline (spread 0.48). Label no: not scored.
  - `asserts_a` hardcoded-data (0.99) · `asserts_b` hardcoded-data (0.99) → asserts: hardcoded-data. **Escalates:** asserts hardcoded-data.
  - `verdict` slop (0.12). **Escalates:** verdict slop.
  - No escalation: `positive_a` yes (0.90) · `positive_b` no (0.02) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 16 clean · smells: `name_matches` (name-mismatch), `readable` (obscure) · unanswered: none · `type` unit (0.96).
- **Label checks:** `asserts` hardcoded-data: match.
</details>
<details><summary><a id="case-59"></a>59. <code>indexes both words</code> · implementation-coupled · OK</summary>

```js
test("indexes both words", () => {
  const engine = new SearchEngine(["apple", "pear"]);
  expect(engine._index).toEqual({ apple: [0], pear: [1] });
})
```
- **Known defect:** implementation-coupled. **Check:** [`observable`](checks/observable/check.mjs). **Expected:** either, `can_fail` yes, `observable` no. Note: The assertion reads the private _index field. Escalation is welcome but not required. Case file [`checks/observable/cases/search-index/case.mjs`](checks/observable/cases/search-index/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Indirect Testing (in Obscure Test)](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (0.99) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 16 clean · smells: `observable` (implementation-coupled), `resilient` (structure-dependent) · unanswered: none · `type` unit (0.99).
- **Label checks:** `observable` no: match.
</details>
<details><summary><a id="case-60"></a>60. <code>notifies the listener</code> · interaction-only · OK</summary>

```js
test("notifies the listener", () => {
  const spy = mock(notify);
  publish(event);
  expect(spy).toHaveBeenCalled();
})
```
- **Known defect:** interaction-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` interaction-only, `verdict` weak. Note: A missing call fails the test, though the mock stands in for behaviour it never verifies. Case file [`checks/asserts/cases/spy-called/case.mjs`](checks/asserts/cases/spy-called/case.mjs), line 4. Sources: [Martin Fowler, Mocks Aren't Stubs (2007)](https://martinfowler.com/articles/mocksArentStubs.html).
- **What decided it:** weak, needs eyes.
  - `asserts_a` interaction-only (1.00) · `asserts_b` interaction-only (1.00) → asserts: interaction-only. **Escalates:** asserts interaction-only.
  - `positive_a` no (0.01) · `positive_b` yes (0.73) → positive: borderline. **Escalates:** positive borderline (spread 0.26).
  - `verdict` weak (1.00). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` yes (0.95) · `can_fail_b` no (0.02) · `can_fail_c` yes (0.96) → can_fail: 0.96, spread 0.03 (stable). Label yes: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 15 clean · smells: `specific` (weak-assert), `fixture` (general-fixture), `readable` (obscure) · unanswered: none · `type` unit (0.96).
- **Label checks:** `asserts` interaction-only: match · `verdict` weak: match.
</details>
<details><summary><a id="case-61"></a>61. <code>publishes twice</code> · interaction-only · OK</summary>

```js
test("publishes twice", () => {
  const spy = mock(publish);
  runBatch(items);
  expect(spy).toHaveBeenCalledTimes(2);
})
```
- **Known defect:** interaction-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` interaction-only. Note: A changed call count fails the test, yet the payload of each call is never asserted. Case file [`checks/asserts/cases/spy-count/case.mjs`](checks/asserts/cases/spy-count/case.mjs), line 4. Sources: [Martin Fowler, Mocks Aren't Stubs (2007)](https://martinfowler.com/articles/mocksArentStubs.html).
- **What decided it:** weak, needs eyes.
  - `asserts_a` interaction-only (1.00) · `asserts_b` interaction-only (1.00) → asserts: interaction-only. **Escalates:** asserts interaction-only.
  - `positive_a` yes (0.54) · `positive_b` no (0.06) → positive: borderline. **Escalates:** positive borderline (spread 0.41).
  - `verdict` weak (1.12). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` yes (0.97) · `can_fail_b` no (0.01) · `can_fail_c` yes (0.99) → can_fail: 0.98, spread 0.01 (stable). Label yes: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 15 clean · smells: `fixture` (general-fixture), `readable` (obscure), `restores` (state-leak) · unanswered: none · `type` unit (0.97).
- **Label checks:** `asserts` interaction-only: match.
</details>
<details><summary><a id="case-62"></a>62. <code>maps a paid, unshipped order to its status code</code> · magic-number · OK</summary>

```js
test("maps a paid, unshipped order to its status code", () => {
  expect(statusCode({ paid: true, shipped: false })).toBe(7);
})
```
- **Known defect:** magic-number. **Check:** [`magic-number`](checks/magic-number/check.mjs). **Expected:** pass, `can_fail` yes, `magic_number` no. Note: Nothing in the test says what 7 means. Case file [`checks/magic-number/cases/order-status/case.mjs`](checks/magic-number/cases/order-status/case.mjs), line 4. Sources: [testsmells.org, Open Catalog of Test Smells: Magic Number Test](https://testsmells.org/pages/testsmells.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 17 clean · smells: `magic_number` (magic-number) · unanswered: none · `type` unit (1.00).
- **Label checks:** `magic_number` no: match.
</details>
<details><summary><a id="case-63"></a>63. <code>computes the tax</code> · name-only · OK</summary>

```js
test("computes the tax", () => {
  const tax = computeTax(100);
  expect(tax).toBeDefined();
})
```
- **Known defect:** name-only. **Check:** [`name-matches`](checks/name-matches/check.mjs). **Expected:** escalate, `can_fail` no, `name_matches` no. Note: name-only: toBeDefined is true for any defined value. Case file [`checks/name-matches/cases/name-only/case.mjs`](checks/name-matches/cases/name-only/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Name-only](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_a` shape-only (1.00) · `asserts_b` shape-only (1.00) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.00) · `positive_b` yes (0.95) → positive: no. **Escalates:** no positive assertion.
  - `verdict` weak (1.00). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` no (0.06) · `can_fail_b` yes (0.89) · `can_fail_c` no (0.01) → can_fail: 0.06, spread 0.10 (stable). Label no: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 15 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `readable` (obscure) · unanswered: none · `type` unit (0.50).
- **Label checks:** `name_matches` no: match.
</details>
<details><summary><a id="case-64"></a>64. <code>computes the tax due</code> · name-only · OK</summary>

```js
test("computes the tax due", () => {
  const tax = computeTax(100);
  expect(tax).toBeDefined();
})
```
- **Known defect:** name-only. **Check:** [`name-matches`](checks/name-matches/check.mjs). **Expected:** escalate, `can_fail` no, `name_matches` no. Note: The name promises a tax value, while toBeDefined is true for any defined value. Case file [`checks/name-matches/cases/tax-defined/case.mjs`](checks/name-matches/cases/tax-defined/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Name-only](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_a` shape-only (1.00) · `asserts_b` shape-only (1.00) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.00) · `positive_b` yes (0.95) → positive: no. **Escalates:** no positive assertion.
  - `verdict` weak (1.00). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` no (0.05) · `can_fail_b` yes (0.96) · `can_fail_c` no (0.01) → can_fail: 0.03, spread 0.04 (stable). Label no: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 14 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `diagnostic` (silent-failure), `readable` (obscure) · unanswered: none · `type` unit (0.59).
- **Label checks:** `name_matches` no: match.
</details>
<details><summary><a id="case-65"></a>65. <code>sorts rows by name</code> · name-only · OK</summary>

```js
test("sorts rows by name", () => {
  const rows = sortRows([{ name: "b" }, { name: "a" }]);
  expect(rows).toHaveLength(2);
})
```
- **Known defect:** name-only. **Check:** [`name-matches`](checks/name-matches/check.mjs). **Expected:** escalate, `can_fail` no, `name_matches` no. Note: The name promises a sort, while the length check holds for any permutation. Case file [`checks/name-matches/cases/sort-length/case.mjs`](checks/name-matches/cases/sort-length/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Name-only](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_a` shape-only (1.00) · `asserts_b` shape-only (1.00) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.01) · `positive_b` yes (0.66) → positive: borderline. **Escalates:** positive borderline (spread 0.32).
  - `verdict` weak (1.00). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` no (0.03) · `can_fail_b` yes (0.95) · `can_fail_c` no (0.01) → can_fail: 0.03, spread 0.04 (stable). Label no: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 16 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch) · unanswered: none · `type` unit (0.98).
- **Label checks:** `name_matches` no: match.
</details>
<details><summary><a id="case-66"></a>66. <code>validates email addresses</code> · name-only · OK</summary>

```js
test("validates email addresses", () => {
  expect(isValidEmail("a@b.com")).toBeTruthy();
})
```
- **Known defect:** name-only. **Check:** [`name-matches`](checks/name-matches/check.mjs). **Expected:** escalate, `can_fail` yes, `name_matches` no. Note: A false result fails it, but the name promises validation, and one truthy check never shows that an invalid address is rejected. Case file [`checks/name-matches/cases/email-truthy/case.mjs`](checks/name-matches/cases/email-truthy/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Name-only](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_a` shape-only (0.98) · `asserts_b` shape-only (0.99) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.22) · `positive_b` yes (0.58) → positive: no. **Escalates:** no positive assertion.
  - `verdict` weak (1.01). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` yes (0.86) · `can_fail_b` no (0.02) · `can_fail_c` yes (0.97) → can_fail: 0.94, spread 0.12 (stable). Label yes: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 15 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `readable` (obscure) · unanswered: none · `type` unit (1.00).
- **Label checks:** `name_matches` no: match.
</details>
<details><summary><a id="case-67"></a>67. <code>both jobs report in start order</code> · non-deterministic · OK</summary>

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
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (0.99) · `can_fail_b` no (0.01) · `can_fail_c` yes (0.93) → can_fail: 0.97, spread 0.07 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.91).
- **Descriptive:** 15 clean · smells: `controlled` (uncontrolled-resource), `deterministic` (non-deterministic), `fast` (slow) · unanswered: none · `type` integration (0.93).
- **Label checks:** `deterministic` no: match.
</details>
<details><summary><a id="case-68"></a>68. <code>debounce fires once</code> · non-deterministic · OK</summary>

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
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (0.98) · `asserts_b` behaviour (0.93) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` no (0.01) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.92).
- **Descriptive:** 15 clean · smells: `controlled` (uncontrolled-resource), `deterministic` (non-deterministic), `fast` (slow) · unanswered: none · `type` unit (1.00).
- **Label checks:** `deterministic` no: match.
</details>
<details><summary><a id="case-69"></a>69. <code>the remote catalogue lists the widget</code> · non-deterministic · OK</summary>

```js
test("the remote catalogue lists the widget", async () => {
  const response = await fetch("https://example.test/catalogue");
  const items = await response.json();
  expect(items).toContain("widget");
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no, `verdict` good. Note: A real catalogue check, but a live fetch makes the result depend on the network. Case file [`checks/deterministic/cases/network/case.mjs`](checks/deterministic/cases/network/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** good, passes.
  - No escalation: `can_fail_a` yes (0.79) · `can_fail_b` no (0.15) · `can_fail_c` yes (0.90) → can_fail: 0.85, spread 0.11 (stable). Label yes: match. `asserts_a` behaviour (0.98) · `asserts_b` behaviour (0.97) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` good (2.19).
- **Descriptive:** 14 clean · smells: `controlled` (uncontrolled-resource), `deterministic` (non-deterministic), `fixture` (general-fixture), `fast` (slow) · unanswered: none · `type` integration (0.72).
- **Label checks:** `deterministic` no: match · `verdict` good: match.
</details>
<details><summary><a id="case-70"></a>70. <code>the retry lands within the window</code> · non-deterministic · OK</summary>

```js
test("the retry lands within the window", async () => {
  const attempts = [];
  retryOnFailure(() => attempts.push(1));
  await sleep(50);
  expect(attempts.length).toBe(2);
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no. Note: A real guard on the retry count, but the fixed sleep makes the outcome depend on scheduling. Case file [`checks/deterministic/cases/timer/case.mjs`](checks/deterministic/cases/timer/case.mjs), line 5. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (0.85) · `can_fail_b` no (0.03) · `can_fail_c` yes (0.88) → can_fail: 0.90, spread 0.13 (stable). Label yes: match. `asserts_a` behaviour (0.96) · `asserts_b` behaviour (0.83) → asserts: behaviour. `positive_a` yes (0.99) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.65).
- **Descriptive:** 14 clean · smells: `controlled` (uncontrolled-resource), `deterministic` (non-deterministic), `fast` (slow), `magic_number` (magic-number) · unanswered: none · `type` unit (0.96).
- **Label checks:** `deterministic` no: match.
</details>
<details><summary><a id="case-71"></a>71. <code>the sorter keeps every random value</code> · non-deterministic · OK</summary>

```js
test("the sorter keeps every random value", () => {
  const input = Array.from({ length: 5 }, () => Math.floor(Math.random() * 100));
  expect(sortNumbers(input)).toEqual([...input].sort((a, b) => a - b));
})
```
- **Known defect:** non-deterministic. **Check:** [`deterministic`](checks/deterministic/check.mjs). **Expected:** pass, `can_fail` yes, `deterministic` no. Note: A real sorting property, but the random input makes a failure hard to reproduce. Case file [`checks/deterministic/cases/randomness/case.mjs`](checks/deterministic/cases/randomness/case.mjs), line 5. Sources: [Kent Beck, Test Desiderata (2019): Deterministic](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (0.96) · `can_fail_b` no (0.02) · `can_fail_c` yes (0.99) → can_fail: 0.98, spread 0.03 (stable). Label yes: match. `asserts_a` behaviour (0.99) · `asserts_b` behaviour (0.89) → asserts: behaviour. `positive_a` yes (0.98) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.93).
- **Descriptive:** 17 clean · smells: `deterministic` (non-deterministic) · unanswered: none · `type` unit (0.99).
- **Label checks:** `deterministic` no: match.
</details>
<details><summary><a id="case-72"></a>72. <code>resolves the route of a request</code> · obscure · OK</summary>

```js
test("resolves the route of a request", () => {
  expect(resolveRoute(FIXTURE_REQUEST)).toEqual(EXPECTED_ROUTE);
})
```
- **Known defect:** obscure. **Check:** [`readable`](checks/readable/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `readable` no. Note: The values are hidden in a test fixture module, not taken from the code under test. Case file [`checks/readable/cases/fixture-route/case.mjs`](checks/readable/cases/fixture-route/case.mjs), line 7. Sources: [Kent Beck, Test Desiderata (2019): Readable](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (0.93) · `asserts_b` behaviour (0.94) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.88).
- **Descriptive:** 16 clean · smells: `fixture` (general-fixture), `readable` (obscure) · unanswered: none · `type` unit (0.99).
- **Label checks:** `asserts` behaviour: match · `readable` no: match.
</details>
<details><summary><a id="case-73"></a>73. <code>finds no imports in an empty file</code> · only-negative · OK</summary>

```js
test("finds no imports in an empty file", () => {
  expect(findImports("")).toEqual([]);
})
```
- **Known defect:** only-negative. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate, `can_fail` yes, `positive` no. Note: Only the empty result is checked, so a finder that never finds anything would pass. Case file [`checks/positive/cases/empty-array/case.mjs`](checks/positive/cases/empty-array/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** strong, needs eyes.
  - `positive_a` no (0.00) · `positive_b` yes (0.99) → positive: no. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (0.96) → asserts: behaviour. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.78).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `positive` no: match.
</details>
<details><summary><a id="case-74"></a>74. <code>no edge for a comment</code> · only-negative · OK</summary>

```js
test("no edge for a comment", () => {
  expect(resolveEdges("// comment")).toBeNull();
})
```
- **Known defect:** only-negative. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate, `can_fail` yes, `positive` no. Note: no positive/negative pair. Case file [`checks/positive/cases/only-negative/case.mjs`](checks/positive/cases/only-negative/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, needs eyes.
  - `positive_a` no (0.00) · `positive_b` yes (1.00) → positive: no. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (0.88) → asserts: behaviour. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` good (2.33).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `positive` no: match.
</details>
<details><summary><a id="case-75"></a>75. <code>returns null for an unknown setting</code> · only-negative · OK</summary>

```js
test("returns null for an unknown setting", () => {
  expect(readSetting({ theme: "dark" }, "font")).toBeNull();
})
```
- **Known defect:** only-negative. **Check:** [`positive`](checks/positive/check.mjs). **Expected:** escalate, `can_fail` yes, `positive` no. Note: Only the absent lookup is checked, so a reader that always returns null would pass. Case file [`checks/positive/cases/absent-key/case.mjs`](checks/positive/cases/absent-key/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: No negative/positive pair](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, needs eyes.
  - `positive_a` no (0.00) · `positive_b` yes (1.00) → positive: no. **Escalates:** no positive assertion.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (0.79) → asserts: behaviour. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` good (2.26).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `positive` no: match.
</details>
<details><summary><a id="case-76"></a>76. <code>dispatches to the registered handler</code> · order-dependent · OK</summary>

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
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 16 clean · smells: `isolated` (order-dependent), `fixture` (general-fixture) · unanswered: none · `type` unit (1.00).
- **Label checks:** `isolated` no: match.
</details>
<details><summary><a id="case-77"></a>77. <code>events are dispatched</code> · passes-with-zero · OK</summary>

```js
test("events are dispatched", () => {
  const dispatched = collect();
  expect(dispatched).toBeDefined();
})
```
- **Known defect:** passes-with-zero. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: The check only asks whether the collection is defined, so no dispatch passes. Case file [`checks/can-fail/cases/empty-dispatch/case.mjs`](checks/can-fail/cases/empty-dispatch/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Vacuous / passes-with-zero](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_a` shape-only (0.58) · `asserts_b` shape-only (0.98) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.00) · `positive_b` yes (0.97) → positive: no. **Escalates:** no positive assertion.
  - `verdict` slop (0.26). **Escalates:** verdict slop.
  - No escalation: `can_fail_a` no (0.01) · `can_fail_b` yes (1.00) · `can_fail_c` no (0.00) → can_fail: 0.01, spread 0.01 (stable). Label no: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 14 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` smoke (0.98).
</details>
<details><summary><a id="case-78"></a>78. <code>imports are folded</code> · passes-with-zero · OK</summary>

```js
test("imports are folded", () => {
  const commit = buildCommit([]);
  expect(commit.imports).toBeDefined();
})
```
- **Known defect:** passes-with-zero. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: vacuous: passes when the feature produces nothing. Case file [`checks/can-fail/cases/vacuous-zero/case.mjs`](checks/can-fail/cases/vacuous-zero/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Vacuous / passes-with-zero](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_a` shape-only (1.00) · `asserts_b` shape-only (1.00) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.00) · `positive_b` yes (0.97) → positive: no. **Escalates:** no positive assertion.
  - `verdict` weak (0.99). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` no (0.15) · `can_fail_b` yes (0.94) · `can_fail_c` no (0.03) → can_fail: 0.08, spread 0.12 (stable). Label no: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 14 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `diagnostic` (silent-failure), `readable` (obscure) · unanswered: none · `type` smoke (0.94).
</details>
<details><summary><a id="case-79"></a>79. <code>parse is stable</code> · self-reference · OK</summary>

```js
test("parse is stable", () => {
  expect(parse(src)).toEqual(parse(src));
})
```
- **Known defect:** self-reference. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: Both sides call the same production function, so the comparison is true by construction. Case file [`checks/can-fail/cases/self-parse/case.mjs`](checks/can-fail/cases/self-parse/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_a` hardcoded-data (0.99) · `asserts_b` hardcoded-data (0.99) → asserts: hardcoded-data. **Escalates:** asserts hardcoded-data.
  - `positive_a` no (0.01) · `positive_b` yes (0.54) → positive: borderline. **Escalates:** positive borderline (spread 0.45).
  - `verdict` slop (0.00). **Escalates:** verdict slop.
  - No escalation: `can_fail_a` no (0.02) · `can_fail_b` yes (1.00) · `can_fail_c` no (0.00) → can_fail: 0.01, spread 0.01 (stable). Label no: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 13 clean · smells: `named` (vague-name), `name_matches` (name-mismatch), `fixture` (general-fixture), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` characterization (0.48).
</details>
<details><summary><a id="case-80"></a>80. <code>reader round trips</code> · self-reference · OK</summary>

```js
test("reader round trips", () => {
  expect(parse(source)).toEqual(parse(source));
})
```
- **Known defect:** self-reference. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: tautology: both sides call the same production code. Case file [`checks/can-fail/cases/tautology-selfreference/case.mjs`](checks/can-fail/cases/tautology-selfreference/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_a` hardcoded-data (0.99) · `asserts_b` hardcoded-data (0.99) → asserts: hardcoded-data. **Escalates:** asserts hardcoded-data.
  - `positive_a` no (0.01) · `positive_b` yes (0.53) → positive: borderline. **Escalates:** positive borderline (spread 0.46).
  - `verdict` slop (0.00). **Escalates:** verdict slop.
  - No escalation: `can_fail_a` no (0.01) · `can_fail_b` yes (1.00) · `can_fail_c` no (0.00) → can_fail: 0.00, spread 0.01 (stable). Label no: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 14 clean · smells: `name_matches` (name-mismatch), `fixture` (general-fixture), `readable` (obscure), `reads_output` (asserts-input) · unanswered: none · `type` unit (0.70).
</details>
<details><summary><a id="case-81"></a>81. <code>the two totals match</code> · self-reference · OK</summary>

```js
test("the two totals match", () => {
  expect(total(rows)).toBe(total(rows));
})
```
- **Known defect:** self-reference. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: One helper backs both sides, so any change to it moves both sides together. Case file [`checks/can-fail/cases/helper-agreement/case.mjs`](checks/can-fail/cases/helper-agreement/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_a` hardcoded-data (0.94) · `asserts_b` hardcoded-data (0.99) → asserts: hardcoded-data. **Escalates:** asserts hardcoded-data.
  - `positive_a` no (0.03) · `positive_b` yes (0.56) → positive: borderline. **Escalates:** positive borderline (spread 0.41).
  - `verdict` slop (0.00). **Escalates:** verdict slop.
  - No escalation: `can_fail_a` no (0.01) · `can_fail_b` yes (1.00) · `can_fail_c` no (0.00) → can_fail: 0.00, spread 0.01 (stable). Label no: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 15 clean · smells: `name_matches` (name-mismatch), `fixture` (general-fixture), `readable` (obscure) · unanswered: none · `type` unit (0.75).
</details>
<details><summary><a id="case-82"></a>82. <code>builds three steps</code> · shape-only · OK</summary>

```js
test("builds three steps", () => {
  const steps = planSteps(task);
  expect(steps.length).toBe(3);
})
```
- **Known defect:** shape-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` shape-only. Note: A wrong count fails the test, yet the step contents are never checked. Case file [`checks/asserts/cases/result-length/case.mjs`](checks/asserts/cases/result-length/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Shape-not-value](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_a` shape-only (0.96) · `asserts_b` shape-only (0.98) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `verdict` weak (1.29). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` yes (0.99) · `can_fail_b` no (0.01) · `can_fail_c` yes (0.98) → can_fail: 0.99, spread 0.01 (stable). Label yes: match. `positive_a` yes (0.99) · `positive_b` no (0.06) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 14 clean · smells: `isolated` (order-dependent), `specific` (weak-assert), `fixture` (general-fixture), `readable` (obscure) · unanswered: none · `type` unit (0.99).
- **Label checks:** `asserts` shape-only: match.
</details>
<details><summary><a id="case-83"></a>83. <code>loads the profile fields</code> · shape-only · OK</summary>

```js
test("loads the profile fields", () => {
  const profile = loadProfile(id);
  expect(Object.keys(profile)).toEqual(["name", "email", "age"]);
})
```
- **Known defect:** shape-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` shape-only. Note: The keys can change and fail the test, but the field values pass unexamined. Case file [`checks/asserts/cases/result-keys/case.mjs`](checks/asserts/cases/result-keys/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Shape-not-value](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** strong, needs eyes.
  - `asserts_a` shape-only (0.69) · `asserts_b` shape-only (0.95) → asserts: shape-only. **Escalates:** asserts shape-only.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.81).
- **Descriptive:** 15 clean · smells: `controlled` (uncontrolled-resource), `fixture` (general-fixture), `readable` (obscure) · unanswered: none · `type` unit (0.94).
- **Label checks:** `asserts` shape-only: match.
</details>
<details><summary><a id="case-84"></a>84. <code>planner returns roads</code> · shape-only · OK</summary>

```js
test("planner returns roads", () => {
  const roads = plan();
  expect(Array.isArray(roads)).toBe(true);
  expect(roads.length).toBe(3);
})
```
- **Known defect:** shape-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` shape-only. Note: shape-not-value: a shape change can fail it, the content is never checked. Case file [`checks/asserts/cases/shape-not-value/case.mjs`](checks/asserts/cases/shape-not-value/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Shape-not-value](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_a` shape-only (0.99) · `asserts_b` shape-only (0.99) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `verdict` weak (1.07). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` yes (0.98) · `can_fail_b` no (0.02) · `can_fail_c` yes (0.83) → can_fail: 0.93, spread 0.15 (stable). Label yes: match. `positive_a` yes (0.88) · `positive_b` no (0.03) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 13 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `fixture` (general-fixture), `readable` (obscure), `magic_number` (magic-number) · unanswered: none · `type` unit (0.69).
- **Label checks:** `asserts` shape-only: match.
</details>
<details><summary><a id="case-85"></a>85. <code>returns a list of routes</code> · shape-only · OK</summary>

```js
test("returns a list of routes", () => {
  const routes = routesFor(graph);
  expect(Array.isArray(routes)).toBe(true);
})
```
- **Known defect:** shape-only. **Check:** [`asserts`](checks/asserts/check.mjs). **Expected:** escalate, `can_fail` yes, `asserts` shape-only, `verdict` weak. Note: The array check can fail when the return type changes, but no route value is ever asserted. Case file [`checks/asserts/cases/result-array/case.mjs`](checks/asserts/cases/result-array/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Shape-not-value](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` no (0.49) · `can_fail_b` yes (0.67) · `can_fail_c` no (0.11) → can_fail: 0.31, spread 0.38 (borderline). **Escalates:** can_fail borderline (spread 0.38). Label yes: not scored.
  - `asserts_a` shape-only (1.00) · `asserts_b` shape-only (1.00) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.05) · `positive_b` yes (0.60) → positive: borderline. **Escalates:** positive borderline (spread 0.36).
  - `verdict` weak (1.00). **Escalates:** verdict weak.
  - No escalation: `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 14 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `fixture` (general-fixture), `readable` (obscure) · unanswered: none · `type` unit (0.56).
- **Label checks:** `asserts` shape-only: match · `verdict` weak: match.
</details>
<details><summary><a id="case-86"></a>86. <code>sorts by price ascending</code> · silent-failure · OK</summary>

```js
test("sorts by price ascending", () => {
  const sorted = sortByPrice([{ price: 3 }, { price: 1 }, { price: 2 }]);
  expect(JSON.stringify(sorted) === JSON.stringify([{ price: 1 }, { price: 2 }, { price: 3 }])).toBe(true);
})
```
- **Known defect:** silent-failure. **Check:** [`diagnostic`](checks/diagnostic/check.mjs). **Expected:** pass, `can_fail` yes, `diagnostic` no. Note: A failure prints expected true, received false. Case file [`checks/diagnostic/cases/price-order/case.mjs`](checks/diagnostic/cases/price-order/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Assertion Roulette (Missing Assertion Message)](http://xunitpatterns.com/Assertion%20Roulette.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (0.99) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.01 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.96).
- **Descriptive:** 15 clean · smells: `specific` (weak-assert), `diagnostic` (silent-failure), `readable` (obscure) · unanswered: none · `type` unit (1.00).
- **Label checks:** `diagnostic` no: match.
</details>
<details><summary><a id="case-87"></a>87. <code>handles overflow</code> · skipped · OK</summary>

```js
test.skip("handles overflow", () => {
  expect(add(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER + 1);
})
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: skipped: the test never runs. Case file [`checks/runs/cases/skipped/case.mjs`](checks/runs/cases/skipped/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, needs eyes.
  - `can_fail_a` no (0.05) · `can_fail_b` yes (0.96) · `can_fail_c` no (0.00) → can_fail: 0.03, spread 0.05 (stable). **Escalates:** can_fail contradicts the verdict.
  - `runs_a` no (0.00) · `runs_b` yes (1.00) → runs: no. **Escalates:** does not run, or narrows the run.
  - No escalation: `asserts_a` behaviour (0.98) · `asserts_b` behaviour (0.83) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `verdict` good (2.18).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (0.99).
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-88"></a>88. <code>parses a dotted key</code> · skipped · OK</summary>

```js
xit("parses a dotted key", () => {
  expect(parseKey("a.b")).toEqual(["a", "b"]);
})
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: The test is marked xit, so it never runs. Case file [`checks/runs/cases/xit-key/case.mjs`](checks/runs/cases/xit-key/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** strong, needs eyes.
  - `can_fail_a` no (0.14) · `can_fail_b` yes (0.77) · `can_fail_c` no (0.01) → can_fail: 0.13, spread 0.22 (stable). **Escalates:** can_fail contradicts the verdict.
  - `runs_a` no (0.00) · `runs_b` yes (1.00) → runs: no. **Escalates:** does not run, or narrows the run.
  - No escalation: `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.01) → positive: yes. `verdict` strong (2.87).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-89"></a>89. <code>rejects a malformed header</code> · skipped · OK</summary>

```js
test.skip("rejects a malformed header", () => {
  expect(() => parseHeader("nope")).toThrow("missing colon");
})
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: The test is marked skip, so it never runs. Case file [`checks/runs/cases/header-pair/case.mjs`](checks/runs/cases/header-pair/case.mjs), line 4. Sources: [testsmells.org, Open Catalog of Test Smells: Ignored Test](https://testsmells.org/pages/testsmells.html).
- **What decided it:** strong, needs eyes.
  - `can_fail_a` no (0.06) · `can_fail_b` yes (0.98) · `can_fail_c` no (0.00) → can_fail: 0.03, spread 0.05 (stable). **Escalates:** can_fail contradicts the verdict.
  - `runs_a` no (0.00) · `runs_b` yes (1.00) → runs: no. **Escalates:** does not run, or narrows the run.
  - No escalation: `asserts_a` behaviour (0.91) · `asserts_b` behaviour (0.74) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.01) → positive: yes. `verdict` strong (2.64).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (0.99).
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-90"></a>90. <code>rejects a stale token</code> · skipped · OK</summary>

```js
test.skip("rejects a stale token", () => {
  expect(verifyToken("expired")).toBe(false);
})
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: The test is marked skipped, so it never runs. Case file [`checks/runs/cases/skip-token/case.mjs`](checks/runs/cases/skip-token/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Skipped / disabled / focused](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** good, needs eyes.
  - `can_fail_a` no (0.07) · `can_fail_b` yes (0.99) · `can_fail_c` no (0.00) → can_fail: 0.03, spread 0.07 (stable). **Escalates:** can_fail contradicts the verdict.
  - `runs_a` no (0.00) · `runs_b` yes (1.00) → runs: no. **Escalates:** does not run, or narrows the run.
  - No escalation: `asserts_a` behaviour (0.94) · `asserts_b` behaviour (0.57) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.01) → positive: yes. `verdict` good (2.50).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (0.99).
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-91"></a>91. <code>splits a dotted key</code> · skipped · OK</summary>

```js
test("splits a dotted key", () => {
    expect(parseKey("a.b")).toEqual(["a", "b"]);
  })
```
- **Known defect:** skipped. **Check:** [`runs`](checks/runs/check.mjs). **Expected:** escalate, `runs` no. Note: The describe around the test is skipped, so the test never runs. Case file [`checks/runs/cases/legacy-block/case.mjs`](checks/runs/cases/legacy-block/case.mjs), line 5, inside `describe.skip("legacy parser", () => {`. Sources: [testsmells.org, Open Catalog of Test Smells: Ignored Test](https://testsmells.org/pages/testsmells.html).
- **What decided it:** strong, needs eyes.
  - `can_fail_a` no (0.34) · `can_fail_b` yes (0.51) · `can_fail_c` no (0.03) → can_fail: 0.29, spread 0.45 (borderline). **Escalates:** can_fail borderline (spread 0.45), can_fail contradicts the verdict.
  - `runs_a` no (0.00) · `runs_b` yes (1.00) → runs: no. **Escalates:** does not run, or narrows the run.
  - No escalation: `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `verdict` strong (2.84).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
- **Label checks:** `runs` no: match.
</details>
<details><summary><a id="case-92"></a>92. <code>finds the largest prime below ten million</code> · slow · OK</summary>

```js
test("finds the largest prime below ten million", () => {
  expect(primesBelow(10_000_000).at(-1)).toBe(9_999_991);
})
```
- **Known defect:** slow. **Check:** [`fast`](checks/fast/check.mjs). **Expected:** pass, `can_fail` yes, `fast` no. Note: The sieve over ten million numbers is heavy work. Case file [`checks/fast/cases/primes-ten-million/case.mjs`](checks/fast/cases/primes-ten-million/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Fast](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 16 clean · smells: `fixture` (general-fixture), `fast` (slow) · unanswered: none · `type` unit (0.98).
- **Label checks:** `fast` no: match.
</details>
<details><summary><a id="case-93"></a>93. <code>the package entry loads</code> · smoke · OK</summary>

```js
test("the package entry loads", async () => {
  await expect(import("../src/index.mjs")).resolves.toBeDefined();
})
```
- **Known defect:** smoke. **Check:** [`type`](checks/type/check.mjs). **Expected:** escalate, `can_fail` yes, `type` smoke. Note: It checks only that something exists, so it is shape-only by nature and escalates. Case file [`checks/type/cases/module-loads/case.mjs`](checks/type/cases/module-loads/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Test Organization and Test Strategy](http://xunitpatterns.com/).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` yes (0.84) · `can_fail_b` yes (0.56) · `can_fail_c` yes (0.82) → can_fail: 0.70, spread 0.40 (borderline). **Escalates:** can_fail borderline (spread 0.40). Label yes: not scored.
  - `asserts_a` shape-only (1.00) · `asserts_b` shape-only (1.00) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.01) · `positive_b` yes (0.96) → positive: no. **Escalates:** no positive assertion.
  - `verdict` weak (0.99). **Escalates:** verdict weak.
  - No escalation: `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 13 clean · smells: `controlled` (uncontrolled-resource), `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `fixture` (general-fixture) · unanswered: none · `type` smoke (1.00).
- **Label checks:** `type` smoke: match.
</details>
<details><summary><a id="case-94"></a>94. <code>reads the port from the environment</code> · state-leak · OK</summary>

```js
test("reads the port from the environment", () => {
  process.env.PORT = "8081";
  expect(portFromEnv()).toBe(8081);
})
```
- **Known defect:** state-leak. **Check:** [`restores`](checks/restores/check.mjs). **Expected:** pass, `can_fail` yes, `restores` no. Note: PORT stays 8081 for every later test. Case file [`checks/restores/cases/port-override/case.mjs`](checks/restores/cases/port-override/case.mjs), line 4. Sources: [Kent Beck, Test Desiderata (2019): Isolated](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 17 clean · smells: `restores` (state-leak) · unanswered: none · `type` unit (1.00).
- **Label checks:** `restores` no: match.
</details>
<details><summary><a id="case-95"></a>95. <code>the reminder fires after an hour</code> · state-leak · OK</summary>

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
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 17 clean · smells: `restores` (state-leak) · unanswered: none · `type` unit (1.00).
- **Label checks:** `deterministic` yes: match · `restores` no: match.
</details>
<details><summary><a id="case-96"></a>96. <code>slugify lowercases through normalise</code> · structure-dependent · OK</summary>

```js
test("slugify lowercases through normalise", () => {
  const spy = vi.spyOn(internal, "normalise");
  expect(slugify("Hello World")).toBe("hello-world");
  expect(spy).toHaveBeenCalledWith("Hello World");
  spy.mockRestore();
})
```
- **Known defect:** structure-dependent. **Check:** [`resilient`](checks/resilient/check.mjs). **Expected:** pass, `can_fail` yes, `asserts` behaviour, `resilient` no. Note: The spy pins an internal helper. The strongest assertion still checks the result. Case file [`checks/resilient/cases/slug-helper/case.mjs`](checks/resilient/cases/slug-helper/case.mjs), line 7. Sources: [Kent Beck, Test Desiderata (2019): Structure-insensitive](https://kentbeck.github.io/TestDesiderata/).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (0.99) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 17 clean · smells: `resilient` (structure-dependent) · unanswered: none · `type` unit (0.94).
- **Label checks:** `asserts` behaviour: match · `resilient` no: match.
</details>
<details><summary><a id="case-97"></a>97. <code>the build is green</code> · tautology · OK</summary>

```js
test("the build is green", () => {
  expect(true).toBe(true);
})
```
- **Known defect:** tautology. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no, `verdict` slop. Note: The assertion holds for every build, so breaking the code cannot fail it. Case file [`checks/can-fail/cases/constant-truth/case.mjs`](checks/can-fail/cases/constant-truth/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing (1.00) · `asserts_b` nothing (1.00) → asserts: nothing. **Escalates:** asserts nothing.
  - `positive_a` no (0.13) · `positive_b` yes (0.53) → positive: borderline. **Escalates:** positive borderline (spread 0.33).
  - `verdict` slop (0.00). **Escalates:** verdict slop.
  - No escalation: `can_fail_a` no (0.00) · `can_fail_b` yes (1.00) · `can_fail_c` no (0.00) → can_fail: 0.00, spread 0.00 (stable). Label no: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 14 clean · smells: `observable` (implementation-coupled), `named` (vague-name), `name_matches` (name-mismatch), `reads_output` (asserts-input) · unanswered: none · `type` smoke (0.85).
- **Label checks:** `verdict` slop: match.
</details>
<details><summary><a id="case-98"></a>98. <code>the world is sane</code> · tautology · OK</summary>

```js
test("the world is sane", () => {
  expect(true).toBe(true);
})
```
- **Known defect:** tautology. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no, `verdict` slop. Note: tautology: true === true. Case file [`checks/can-fail/cases/tautology-constant/case.mjs`](checks/can-fail/cases/tautology-constant/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Tautology / self-reference](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** slop, needs eyes.
  - `asserts_a` nothing (1.00) · `asserts_b` nothing (1.00) → asserts: nothing. **Escalates:** asserts nothing.
  - `positive_a` no (0.28) · `positive_b` no (0.41) → positive: borderline. **Escalates:** positive borderline (spread 0.31).
  - `verdict` slop (0.00). **Escalates:** verdict slop.
  - No escalation: `can_fail_a` no (0.00) · `can_fail_b` yes (1.00) · `can_fail_c` no (0.00) → can_fail: 0.00, spread 0.00 (stable). Label no: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 15 clean · smells: `named` (vague-name), `name_matches` (name-mismatch), `reads_output` (asserts-input) · unanswered: none · `type` smoke (0.62).
- **Label checks:** `verdict` slop: match.
</details>
<details><summary><a id="case-99"></a>99. <code>reads the port from the sample file</code> · uncontrolled-resource · OK</summary>

```js
test("reads the port from the sample file", () => {
  const text = readFileSync("fixtures/sample.ini", "utf8");
  expect(parseIni(text).port).toBe(8080);
})
```
- **Known defect:** uncontrolled-resource. **Check:** [`controlled`](checks/controlled/check.mjs). **Expected:** pass, `can_fail` yes, `controlled` no. Note: The file is assumed present; its content does not change between runs. Case file [`checks/controlled/cases/sample-ini/case.mjs`](checks/controlled/cases/sample-ini/case.mjs), line 6. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Resource Optimism (in Erratic Test)](http://xunitpatterns.com/Erratic%20Test.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.99).
- **Descriptive:** 15 clean · smells: `controlled` (uncontrolled-resource), `fixture` (general-fixture), `fast` (slow) · unanswered: none · `type` integration (0.95).
- **Label checks:** `controlled` no: match.
</details>
<details><summary><a id="case-100"></a>100. <code>the queue is not negative</code> · vacuous · OK</summary>

```js
test("the queue is not negative", () => {
  expect(queue.length).toBeGreaterThanOrEqual(0);
})
```
- **Known defect:** vacuous. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: A length is never negative, so the bound is always true. Case file [`checks/can-fail/cases/count-nonnegative/case.mjs`](checks/can-fail/cases/count-nonnegative/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Vacuous / passes-with-zero](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` no (0.34) · `can_fail_b` yes (0.81) · `can_fail_c` no (0.04) → can_fail: 0.19, spread 0.30 (borderline). **Escalates:** can_fail borderline (spread 0.30). Label no: not scored.
  - `asserts_a` shape-only (0.98) · `asserts_b` shape-only (0.99) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.06) · `positive_b` yes (0.62) → positive: borderline. **Escalates:** positive borderline (spread 0.32).
  - `verdict` weak (0.99). **Escalates:** verdict weak.
  - No escalation: `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 13 clean · smells: `isolated` (order-dependent), `specific` (weak-assert), `name_matches` (name-mismatch), `fixture` (general-fixture), `readable` (obscure) · unanswered: none · `type` smoke (0.53).
</details>
<details><summary><a id="case-101"></a>101. <code>the summary is produced</code> · vacuous · OK</summary>

```js
test("the summary is produced", () => {
  const summary = summarise(rows);
  expect(summary.totals).toBeDefined();
})
```
- **Known defect:** vacuous. **Check:** [`can-fail`](checks/can-fail/check.mjs). **Expected:** escalate, `can_fail` no. Note: The aggregate exists, but no value inside it is ever read. Case file [`checks/can-fail/cases/aggregate-exists/case.mjs`](checks/can-fail/cases/aggregate-exists/case.mjs), line 5. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Vacuous / passes-with-zero](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` yes (0.61) · `can_fail_b` yes (0.76) · `can_fail_c` no (0.04) → can_fail: 0.30, spread 0.57 (unstable). **Escalates:** can_fail unstable (spread 0.57). Label no: not scored.
  - `asserts_a` shape-only (1.00) · `asserts_b` shape-only (1.00) → asserts: shape-only. **Escalates:** asserts shape-only.
  - `positive_a` no (0.00) · `positive_b` yes (0.95) → positive: no. **Escalates:** no positive assertion.
  - `verdict` weak (1.00). **Escalates:** verdict weak.
  - No escalation: `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 12 clean · smells: `specific` (weak-assert), `named` (vague-name), `name_matches` (name-mismatch), `diagnostic` (silent-failure), `fixture` (general-fixture), `readable` (obscure) · unanswered: none · `type` smoke (0.91).
</details>
<details><summary><a id="case-102"></a>102. <code>works</code> · vague-name · OK</summary>

```js
test("works", () => {
  expect(parseNumber("42")).toBe(42);
})
```
- **Known defect:** vague-name. **Check:** [`named`](checks/named/check.mjs). **Expected:** pass, `can_fail` yes, `named` no. Note: The name says nothing about the behaviour. Case file [`checks/named/cases/parse-digits/case.mjs`](checks/named/cases/parse-digits/case.mjs), line 4. Sources: [Gerard Meszaros, xUnit Test Patterns (2007): Obscure Test](http://xunitpatterns.com/Obscure%20Test.html).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (3.00).
- **Descriptive:** 16 clean · smells: `named` (vague-name), `name_matches` (name-mismatch) · unanswered: none · `type` unit (1.00).
- **Label checks:** `named` no: match.
</details>
<details><summary><a id="case-103"></a>103. <code>reads the major version</code> · weak-assert · OK</summary>

```js
test("reads the major version", () => {
  expect(parseVersion("1.2.3").major).toBeGreaterThan(0);
})
```
- **Known defect:** weak-assert. **Check:** [`specific`](checks/specific/check.mjs). **Expected:** either, `can_fail` yes, `specific` no. Note: Any positive major passes. Escalation is welcome but not required. Case file [`checks/specific/cases/major-bound/case.mjs`](checks/specific/cases/major-bound/case.mjs), line 4. Sources: [Web Platform Tests, Review Checklist: "The test uses the most specific asserts possible"](https://web-platform-tests.org/reviewing-tests/checklist.html).
- **What decided it:** weak, needs eyes.
  - `can_fail_a` no (0.44) · `can_fail_b` no (0.03) · `can_fail_c` yes (0.74) → can_fail: 0.72, spread 0.53 (unstable). **Escalates:** can_fail unstable (spread 0.53). Label yes: not scored.
  - `asserts_a` behaviour (0.71) · `asserts_b` shape-only (0.95) → asserts: unstable. **Escalates:** asserts unstable (behaviour vs shape-only).
  - `positive_a` yes (0.72) · `positive_b` no (0.01) → positive: borderline. **Escalates:** positive borderline (spread 0.27).
  - `verdict` weak (1.05). **Escalates:** verdict weak.
  - No escalation: `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 15 clean · smells: `specific` (weak-assert), `name_matches` (name-mismatch), `readable` (obscure) · unanswered: none · `type` unit (0.99).
- **Label checks:** `specific` no: match.
</details>
<details><summary><a id="case-104"></a>104. <code>builds a job with the given name</code> · wrong-reason · OK</summary>

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
- **Known defect:** wrong-reason. **Check:** [`reads-output`](checks/reads-output/check.mjs). **Expected:** either, `can_fail` yes. Note: The asserted field is copied from the argument, so a stub that only copies would pass. Only the mutation check proves this, so escalation is welcome but not required. Case file [`checks/reads-output/cases/passthrough-argument/case.mjs`](checks/reads-output/cases/passthrough-argument/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Passes for the wrong reason](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** strong, passes.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `asserts_a` behaviour (1.00) · `asserts_b` behaviour (1.00) → asserts: behaviour. `positive_a` yes (1.00) · `positive_b` no (0.00) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes. `verdict` strong (2.57).
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
</details>
<details><summary><a id="case-105"></a>105. <code>normalise trims the title</code> · wrong-reason · OK</summary>

```js
test("normalise trims the title", () => {
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
- **Known defect:** wrong-reason. **Check:** [`reads-output`](checks/reads-output/check.mjs). **Expected:** escalate, `can_fail` no, `asserts` input-only, `reads_output` no. Note: The name promises a trimmed title, but the assertion reads the untouched input, so broken trimming still passes. Case file [`checks/reads-output/cases/asserts-input/case.mjs`](checks/reads-output/cases/asserts-input/case.mjs), line 6. Sources: [the house catalogue, verify-prd-implemented/test-patterns.md: Passes for the wrong reason](https://github.com/Vortiago/Verktoykasse/blob/main/verify-prd-implemented/test-patterns.md).
- **What decided it:** weak, needs eyes.
  - `asserts_a` input-only (0.97) · `asserts_b` input-only (0.90) → asserts: input-only. **Escalates:** asserts input-only.
  - `verdict` weak (0.57). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` no (0.06) · `can_fail_b` yes (0.94) · `can_fail_c` no (0.01) → can_fail: 0.04, spread 0.04 (stable). Label no: match. `positive_a` yes (0.89) · `positive_b` no (0.06) → positive: yes. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 16 clean · smells: `name_matches` (name-mismatch), `reads_output` (asserts-input) · unanswered: none · `type` unit (0.98).
- **Label checks:** `asserts` input-only: match · `reads_output` no: match.
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
  - `asserts_a` behaviour (0.95) · `asserts_b` nothing (0.58) → asserts: unstable. **Escalates:** asserts unstable (behaviour vs nothing).
  - `positive_a` no (0.00) · `positive_b` yes (1.00) → positive: no. **Escalates:** no positive assertion.
  - `verdict` weak (1.31). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` yes (1.00) · `can_fail_b` no (0.00) · `can_fail_c` yes (1.00) → can_fail: 1.00, spread 0.00 (stable). Label yes: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 18 clean · smells: none · unanswered: none · `type` unit (1.00).
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
  - `asserts_a` interaction-only (1.00) · `asserts_b` interaction-only (1.00) → asserts: interaction-only. **Escalates:** asserts interaction-only.
  - `positive_a` no (0.01) · `positive_b` yes (0.63) → positive: borderline. **Escalates:** positive borderline (spread 0.36).
  - `verdict` weak (1.00). **Escalates:** verdict weak.
  - No escalation: `can_fail_a` yes (0.94) · `can_fail_b` no (0.04) · `can_fail_c` yes (0.79) → can_fail: 0.90, spread 0.18 (stable). Label yes: match. `runs_a` yes (1.00) · `runs_b` no (0.00) → runs: yes.
- **Descriptive:** 10 clean · smells: `observable` (implementation-coupled), `specific` (weak-assert), `name_matches` (name-mismatch), `resilient` (structure-dependent), `diagnostic` (silent-failure), `fixture` (general-fixture), `readable` (obscure), `restores` (state-leak) · unanswered: none · `type` unit (0.99).
- **Label checks:** `asserts` interaction-only: match.
</details>

## Legend

- **Case**: one labelled test in `checks/<check>/cases/<case>/`. `case.mjs` holds the test, `label.json` states the known defect and the expected outcome, and `code.mjs`, if the case has one, holds the code under test.
- **Check**: the check that the case is meant to catch, in `checks/<check>/check.mjs`. A mixed case, and a clean case that pins no single check, belong to the `verdict` check. A label can also name a check and the value it must give.
- **Escalate**: the tool sends the test to a human, so the test **needs eyes**. Each reason says why. A test with no reason **passes**.
- **can_fail**: the probability that a change to the code under test can make the test fail. The tool asks it in 3 phrasings and takes the mean. The **spread** is the highest value minus the lowest. A spread above `TEST_AUDIT_STABLE_BAND` makes the value borderline or unstable, and the test escalates.
- **Twin pair**: `positive` (`positive_a`, `positive_b`) and `runs` (`runs_a`, `runs_b`). The tool asks each twice. The value counts only when both phrasings agree. A "no" escalates.
- **Negated phrasing**: `can_fail_b`, `positive_b`, `runs_b` ask the opposite, so their "no" is the good answer.
- **asserts**: what the assertion checks. Only `behaviour` is a real guard. `asserts_a` and `asserts_b` list the options in opposite order, and must agree.
- **verdict**: a score from 0 (slop) to 3 (strong). A verdict of weak or lower escalates.
- **Descriptive question**: a "no" is a **smell**. It raises the flag in brackets. It does not escalate the test.
- **Number in brackets**: for a yes/no question, the probability of yes. For a choice, the probability of the chosen option. For the verdict, the score.
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
| `can_fail_a` | Break the behaviour this test names, in the code under test only. Does the test then fail? Any break counts, including one that changes only the shape of the result or makes the call throw. | yes: the test fails when the named behaviour is broken |
| `can_fail_b` | Does this test keep passing however the code under test breaks the behaviour this test names? | yes: no break of the named behaviour makes the test fail |
| `can_fail_c` | If the behaviour this test names regresses, does the test fail? | yes: a regression in that behaviour makes the test fail |
| `asserts_a` | Taken together, what do the assertions of this test check about the code under test? Pick the kind of the strongest assertion. | one of: behaviour, hardcoded-data, input-only, shape-only, interaction-only, nothing |
| `asserts_b` | What does the strongest assertion in this test check? | one of: nothing, interaction-only, shape-only, input-only, hardcoded-data, behaviour |
| `positive_a` | Does at least one assertion name a value that the code under test must produce, such as a literal, an object, a thrown error with its message, or the true or false result the name asks for? An empty array, string, or object, null, or undefined does not count, even written as a literal. | yes: at least one assertion names a value that must be produced |
| `positive_b` | Does every assertion in this test check only that something is null, undefined, empty, or did not throw? An expected empty array, string, or object counts as empty. | yes: every assertion checks only that something is null, undefined, empty, or did not throw |
| `runs_a` | Does this test run, and does every other test in the file run? Read the test head, the scope field, and the flags field. A skip, todo, or skipIf marker, or an x prefix such as xit or xdescribe, on the test or on a describe around it stops this test. An only or focus marker anywhere in the file, such as it.only, fit, or fdescribe, shows as the flag focus-in-file and leaves other tests out. | yes: this test runs, and no marker in the file leaves another test out |
| `runs_b` | Does a marker stop this test or narrow the run? Read the test head, the scope field, and the flags field. A skip, todo, or skipIf marker, or an x prefix such as xit or xdescribe, on the test or on a describe around it stops this test. An only or focus marker anywhere in the file, such as it.only, fit, or fdescribe, shows as the flag focus-in-file and leaves other tests out. | yes: a marker stops this test, or a marker in the file leaves other tests out |
| `type` | What type of test is this? If the name cites a bug or an issue, answer regression. If the test pins current output as a baseline before a change, answer characterization. If it only checks that something runs or exists, answer smoke. Otherwise answer by scope: unit, integration, or e2e. | one of: unit, integration, regression, e2e, smoke, characterization |
| `observable` | Does the assertion read an output or an effect that a caller of the public interface could see? A return value, a thrown error, a change the caller can read back, or a message sent through an injected port is observable. A private field, an underscore member, an internal helper call, or the order of internal calls is not. | yes: it asserts an output or effect a caller could see |
| `conditional` | Does every assertion in this test always run? Answer no when a branch, a loop over a value that may be empty, an early return, or a try/catch can leave an assertion unrun or swallow its failure. | yes: every assertion always runs |
| `isolated` | Does this test read only values that it builds itself, or that a hook in fixtures builds before each test? Answer no when it reads a value that another test must set, or mutable state in setup that is shared with other tests and that no hook resets. An object the file declares once, such as a registry, that this test reads but another test fills, is shared state. | yes: it builds what it reads, so it passes alone and in any order |
| `controlled` | Does the test create or fake every external thing it reads, such as a file, a server, an environment variable, or the clock? Answer yes when it reads none. | yes: it creates or fakes every external resource it reads, or it reads none |
| `specific` | Does the assertion pin the expected value with an exact matcher, such as toBe, toEqual, toStrictEqual, or toThrow with a message? Answer no when it uses a weak form that also passes on wrong output: toBeDefined, toBeTruthy, typeof, Array.isArray, a length, a bound such as toBeGreaterThan(0), or a boolean folded from a comparison. | yes: the assertion pins the expected value |
| `named` | Does the test's name state the behaviour it checks, rather than a vague label such as works, test1, should be fine, or only the name of the unit, such as add or parser? | yes: the name says which behaviour the test checks |
| `deterministic` | Does this test give the same result on every run? It does not when it reads the real clock or real randomness, calls the network, waits on a sleep, or relies on an order nothing guarantees. A clock, timer, or random source that the test fakes or seeds is under its control and is fine. | yes: the result is the same on every run of the same code |
| `one_thing` | Does this test check one behaviour, rather than several unrelated behaviours at once? Several assertions on one result count as one behaviour. Several actions on different units, each with its own assertion, count as several. | yes: it checks one behaviour |
| `name_matches` | Does the test body assert the behaviour its name states? If the name states no behaviour, answer no. A body that checks only that the result is truthy, defined, or of a type does not assert the behaviour. | yes: the body asserts the behaviour the name promises |
| `resilient` | Would a refactor that keeps the public behaviour of the code under test keep this test green? Answer no when the test imports an internal module, spies on an internal helper, reads a private field, pins the order of internal calls, or pins an internal structure in a snapshot. | yes: the test reaches the code only through its public interface and asserts only results, so a refactor keeps it green |
| `diagnostic` | Does each assertion compare a value with a matcher that reports the expected and the received value, such as toBe or toEqual? A bare boolean check such as expect(a === b).toBe(true) or assert(ok), a comparison folded into one boolean, or one assertion repeated in a loop with no index hides which value was wrong. | yes: each failure shows the received value and the expected value |
| `fixture` | Does the test, or a hook in fixtures or code in setup, build the data the test reads, and no more? Answer no when the test reads a value that nothing shown builds, or when the fixture holds far more than the behaviour needs. | yes: it builds the data it reads, and only that |
| `fast` | Does the test finish without a sleep, a poll, a network or disk call, or a loop over a large input? An await on an in-memory promise is fine. | yes: it does none of these |
| `readable` | Does the test show the input, the action, and the expected result? Answer no when the input or the expected value comes from a helper, an import, or a name that nothing shown defines, or when the comparison hides in a boolean. | yes: the input, the action, and the expected result are visible in the test |
| `magic_number` | Can a reader tell what each literal in the assertion means from the test name, the input, or a name beside it? A plain result of the input, such as 180 seconds for 3 minutes, is fine. A code, a flag, or a total that the reader must look up in the code under test is a magic number. | yes: the meaning of each literal is clear from the test |
| `reads_output` | Does the assertion read the value the code under test produced, rather than its own input, its setup, or only that no error was thrown? A test that asserts its argument is unchanged counts as yes only when its name says the code must not change it. | yes: it asserts the returned or observed output |
| `automated` | Does this test reach a pass or fail with no person doing or reading anything? | yes: it is self-checking and unattended |
| `restores` | Does the test leave every global, environment variable, timer, module mock, spy, and shared object that the file or its setup declares as it found them? A restore in an after hook in fixtures counts. A test that changes none of these counts as yes. | yes: it changes none of these, or it restores what it changes |
| `verdict` | Overall, is this test a real guard? Slop: it asserts nothing, or it cannot fail at all, such as a tautology or two sides that both come from the code under test. Weak: it asserts only a shape, a mock call, an absence, or its own input passed straight through, so it misses most ways the named behaviour can break. Good: it asserts a value or effect that the named behaviour decides. Strong: good, with an exact expected value that would fail loudly. An expected value the test computes itself without the code under test, such as a sorted copy of its input, is a real expected value. Judge only what the assertions check: a smell from the other definitions, such as slow, flaky, the real clock, randomness, the network, a manual step, uncontrolled, a vague name, a magic number, or a state leak, does not lower the level. | scale: slop, weak, good, strong |
