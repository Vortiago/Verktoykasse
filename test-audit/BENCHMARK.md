# test-audit benchmark

The corpus scores a decision model on how well it separates a real test guard
from fake safety. Each run records, for every case, the result of every check.

## Reference run: qwen3.8-flash-next-mtp on llama-arbiter

Date: 2026-10-06. Endpoint: [llama-arbiter](https://github.com/Vortiago/llama-arbiter), `POST /v1/systemone`.

```sh
TEST_AUDIT_CONCURRENCY=3 TEST_AUDIT_TIMEOUT_MS=600000 node cli.mjs --selftest --benchmark \
  --targets "http://koishi.tail6defbc.ts.net:8090|qwen3.8-flash-next-mtp"
```


Endpoint `http://koishi.tail6defbc.ts.net:8090`. 62 cases, 62 calls, 54914 tokens.

can_fail agreement: 38/39 resolved (97%). Silent passes: 0. Mixed routed: 5/5. False positives: 4/18. deterministic: 6/8.

defects escalated: ambiguous 5/5, commented-out 2/2, early-return 1/1, focused 2/2, hardcoded-data 2/2, interaction-only 3/3, name-only 4/4, only-negative 4/4, passes-with-zero 2/2, self-reference 3/3, shape-only 4/4, skipped 3/3, tautology 2/2, vacuous 2/2, wrong-reason 2/2

| Test | Defect | can_fail | spread | asserts | runs | obs | cond | iso | ctl | spec | name | det | one | nm | res | diag | fix | fast | read | magic | out | auto | rest | verdict | eyes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| the world is sane | tautology | 0.00 | 0.00 | nothing | yes | - | + | + | + | - | - | + | + | - | + | + | + | + | + | + | - | + | + | slop | yes |
| reader round trips | self-reference | 0.00 | 0.01 | nothing | yes | + | + | + | - | - | - | + | + | - | + | + | + | + | - | + | - | + | + | slop | yes |
| imports are folded | passes-with-zero | 0.02 | 0.07 | shape-only | yes | + | + | + | + | - | + | + | + | - | + | - | + | + | - | + | + | + | + | slop | yes |
| planner returns roads | shape-only | 0.63! | 0.85 | shape-only | yes | + | + | + | + | - | - | + | + | - | + | + | + | + | - | - | + | + | + | weak | yes |
| computes the tax | name-only | 0.03 | 0.09 | shape-only | yes | + | + | + | + | - | - | + | + | - | + | - | + | + | - | + | + | + | + | slop | yes |
| handles overflow | skipped | 0.10 | 0.16 | behaviour | - | + | + | + | + | + | - | + | + | + | + | + | + | + | + | + | + | + | + | slop | yes |
| parses config | commented-out | 0.00 | 0.00 | nothing | yes | + | + | + | + | - | - | + | + | - | + | - | + | + | - | + | - | + | + | slop | yes |
| saves the user | wrong-reason | 0.47! | 0.59 | interaction-only | yes | - | + | + | + | - | + | + | + | - | - | - | + | + | - | + | - | + | - | slop | yes |
| no edge for a comment | only-negative | 0.98 | 0.04 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | strong | yes |
| debounce fires once | non-deterministic | 0.99 | 0.02 | behaviour | yes | + | + | + | - | + | + | - | + | + | + | + | + | - | + | - | + | + | + | good | - |
| add handles negatives | clean | 1.00 | 0.00 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | strong | - |
| reverses a string | clean | 1.00 | 0.00 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | strong | - |
| regression #42: a single import resolves | clean | 1.00 | 0.00 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | strong | - |
| store round trips a value | clean | 1.00 | 0.00 | behaviour | yes | + | + | + | - | + | + | + | + | + | + | + | + | + | + | + | + | + | - | strong | - |
| the server answers health | clean | 1.00 | 0.00 | behaviour | yes | + | + | + | - | + | + | - | + | + | + | + | + | + | + | + | + | + | + | strong | - |
| the world is sane | ambiguous | 0.01 | 0.01 | nothing | yes | - | + | + | + | - | - | + | - | - | - | + | + | + | - | + | - | + | + | slop | yes |
| builds the graph | ambiguous | 0.34! | 0.96 | shape-only | yes | + | + | + | + | - | - | + | + | - | + | + | + | + | - | - | + | + | + | weak | yes |
| retries once | ambiguous | 0.79! | 0.41 | interaction-only | yes | - | + | + | + | + | + | + | + | - | - | + | + | + | - | + | - | + | + | weak | yes |
| returns a list of routes | shape-only | 0.27! | 0.80 | shape-only | yes | + | + | + | + | - | + | + | + | - | + | + | + | + | + | + | + | + | + | slop | yes |
| builds three steps | shape-only | 0.88 | 0.22 | shape-only | yes | + | + | + | + | - | + | + | + | + | + | + | + | + | + | - | + | + | + | weak | yes |
| loads the profile fields | shape-only | 0.97 | 0.07 | shape-only | yes | + | + | + | - | + | - | + | + | + | + | + | + | + | + | + | + | + | + | good | yes |
| notifies the listener | interaction-only | 0.76! | 0.52 | interaction-only | yes | - | + | + | + | - | + | + | + | + | - | + | + | + | - | + | - | + | - | weak | yes |
| publishes twice | interaction-only | 0.95 | 0.11 | interaction-only | yes | - | + | + | + | + | + | + | + | + | - | + | + | + | + | + | - | + | - | weak | yes |
| forwards the payload | interaction-only | 0.55! | 0.63 | interaction-only | yes | - | + | + | + | - | + | + | + | - | - | + | + | + | + | + | + | + | - | weak | yes |
| taxes the standard rate | hardcoded-data | 0.12 | 0.19 | hardcoded-data | yes | + | + | + | + | + | + | + | + | - | + | + | + | + | - | + | + | + | + | slop | yes |
| resolves the status labels | hardcoded-data | 0.87! | 0.30 | hardcoded-data | yes | + | + | + | + | + | - | + | + | + | + | + | + | + | + | + | + | + | + | good | yes |
| the retry lands within the window | non-deterministic | 0.76! | 0.60 | behaviour | yes | - | + | + | - | + | + | - | + | + | - | + | + | - | - | - | + | + | - | weak | yes |
| the token has not expired yet | non-deterministic | 0.87! | 0.28 | behaviour | yes | + | + | + | - | + | + | - | + | + | + | + | + | + | + | + | + | + | + | weak | yes |
| the remote catalogue lists the widget | non-deterministic | 0.84 | 0.20 | behaviour | yes | + | + | + | - | + | + | - | + | + | + | + | + | - | + | + | + | + | + | weak | yes |
| the sorter keeps every random value | non-deterministic | 0.96 | 0.06 | hardcoded-data | yes | + | + | + | - | + | + | + | + | + | + | + | + | + | + | + | + | + | + | good | yes |
| the metric keys keep their insertion order | non-deterministic | 0.99 | 0.01 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | strong | - |
| the build is green | tautology | 0.00 | 0.00 | nothing | yes | + | + | + | + | - | - | + | + | - | + | + | + | + | + | + | - | + | + | slop | yes |
| parse is stable | self-reference | 0.00 | 0.01 | nothing | yes | + | + | + | + | - | - | + | + | - | + | + | + | + | - | + | + | + | + | slop | yes |
| the two totals match | self-reference | 0.00 | 0.00 | nothing | yes | + | + | + | + | - | + | + | + | - | + | + | + | + | - | - | + | + | + | slop | yes |
| events are dispatched | passes-with-zero | 0.01 | 0.01 | nothing | yes | + | + | + | + | - | - | + | + | - | + | - | + | + | - | + | - | + | + | slop | yes |
| the summary is produced | vacuous | 0.16! | 0.44 | shape-only | yes | + | + | + | + | - | - | + | + | - | + | + | + | + | - | + | + | + | + | slop | yes |
| the queue is not negative | vacuous | 0.03 | 0.02 | shape-only | yes | + | + | + | + | - | + | + | + | + | + | + | + | + | - | + | + | + | + | slop | yes |
| converts minutes to seconds | clean | 1.00 | 0.00 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | strong | - |
| slugs a display name | clean | 1.00 | 0.00 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | strong | - |
| regression #77: a trimmed name keeps its inner spaces | clean | 1.00 | 0.00 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | strong | - |
| the cache returns a stored value | clean | 1.00 | 0.00 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | - | strong | - |
| the service reports its version | clean | 1.00 | 0.00 | behaviour | yes | + | + | + | - | + | + | - | + | + | + | + | + | + | + | + | + | + | + | strong | - |
| formats a receipt line | clean | 1.00 | 0.00 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | strong | - |
| the schema is sound | ambiguous | 0.19! | 0.54 | nothing | yes | + | + | + | + | - | - | + | - | - | - | + | + | + | - | - | - | + | + | slop | yes |
| collects the graph nodes | ambiguous | 0.33! | 0.96 | shape-only | yes | + | + | + | + | - | - | + | + | - | + | + | + | + | - | - | + | + | + | weak | yes |
| computes the tax due | name-only | 0.01 | 0.03 | shape-only | yes | + | + | + | + | - | - | + | + | - | + | - | + | + | - | + | + | + | + | slop | yes |
| validates email addresses | name-only | 0.69! | 0.80 | shape-only | yes | + | + | + | + | - | - | + | + | - | + | + | + | + | + | + | + | + | + | weak | yes |
| sorts rows by name | name-only | 0.18! | 0.53 | shape-only | yes | + | + | + | + | - | + | + | + | - | + | + | + | + | + | + | + | + | + | slop | yes |
| rejects a stale token | skipped | 0.04 | 0.08 | nothing | - | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | slop | yes |
| parses a dotted key | skipped | 0.39! | 0.51 | behaviour | - | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | slop | yes |
| saves the draft | focused | 0.97 | 0.05 | behaviour | - | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | weak | yes |
| loads the draft | focused | 0.84! | 0.32 | hardcoded-data | yes | + | + | + | + | + | - | + | + | + | + | + | + | + | + | + | + | + | + | good | yes |
| merges the options | commented-out | 0.00 | 0.00 | nothing | yes | + | + | + | + | - | - | + | + | - | + | + | + | + | - | + | - | + | + | slop | yes |
| rejects a blank name | early-return | 0.01 | 0.01 | nothing | - | + | - | + | + | + | + | + | + | - | + | - | + | + | + | + | + | + | + | slop | yes |
| creating a user validates, stores and notifies | eager | 0.99 | 0.02 | behaviour | yes | + | + | + | + | + | + | + | - | + | + | + | + | + | + | + | + | + | + | strong | - |
| the pipeline parses, formats and lints | eager | 1.00 | 0.00 | behaviour | yes | + | + | + | + | + | - | + | - | + | + | + | + | + | + | + | + | + | + | strong | - |
| normalise keeps the title text | wrong-reason | 0.05 | 0.05 | hardcoded-data | yes | + | + | + | + | + | + | + | + | - | - | + | + | + | + | + | - | + | + | slop | yes |
| reports no booking for a free slot | wrong-reason | 0.97 | 0.06 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | good | yes |
| builds a job with the given name | wrong-reason | 1.00 | 0.01 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | strong | - |
| returns null for an unknown setting | only-negative | 1.00 | 0.01 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | strong | yes |
| finds no imports in an empty file | only-negative | 1.00 | 0.00 | behaviour | yes | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | + | strong | yes |
| parses a well formed header | only-negative | 0.25! | 0.70 | nothing | yes | + | + | + | + | - | + | + | + | - | + | + | + | + | + | + | - | + | + | slop | yes |

Needs eyes:
- `the world is sane` (tautology): asserts nothing; verdict slop
- `reader round trips` (self-reference): asserts nothing; verdict slop
- `imports are folded` (passes-with-zero): no positive assertion; asserts shape-only; verdict slop
- `planner returns roads` (shape-only): can_fail unstable (spread 0.85); asserts shape-only; verdict weak
- `computes the tax` (name-only): no positive assertion; asserts shape-only; verdict slop
- `handles overflow` (skipped): does not run; verdict slop
- `parses config` (commented-out): no positive assertion; asserts nothing; verdict slop
- `saves the user` (wrong-reason): can_fail unstable (spread 0.59); asserts interaction-only; verdict slop
- `no edge for a comment` (only-negative): no positive assertion
- `the world is sane` (ambiguous): asserts nothing; verdict slop
- `builds the graph` (ambiguous): can_fail unstable (spread 0.96); asserts shape-only; verdict weak
- `retries once` (ambiguous): can_fail borderline (spread 0.41); no positive assertion; asserts interaction-only; verdict weak
- `returns a list of routes` (shape-only): can_fail unstable (spread 0.80); asserts shape-only; verdict slop
- `builds three steps` (shape-only): asserts shape-only; verdict weak
- `loads the profile fields` (shape-only): asserts shape-only
- `notifies the listener` (interaction-only): can_fail unstable (spread 0.52); asserts interaction-only; verdict weak
- `publishes twice` (interaction-only): asserts interaction-only; verdict weak
- `forwards the payload` (interaction-only): can_fail unstable (spread 0.63); asserts interaction-only; verdict weak
- `taxes the standard rate` (hardcoded-data): asserts hardcoded-data; verdict slop
- `resolves the status labels` (hardcoded-data): can_fail borderline (spread 0.30); asserts hardcoded-data
- `the retry lands within the window` (non-deterministic): can_fail unstable (spread 0.60); asserts unstable (behaviour vs shape-only); verdict weak
- `the token has not expired yet` (non-deterministic): can_fail borderline (spread 0.28); verdict weak
- `the remote catalogue lists the widget` (non-deterministic): verdict weak
- `the sorter keeps every random value` (non-deterministic): asserts unstable (hardcoded-data vs behaviour)
- `the build is green` (tautology): asserts nothing; verdict slop
- `parse is stable` (self-reference): asserts nothing; verdict slop
- `the two totals match` (self-reference): asserts nothing; verdict slop
- `events are dispatched` (passes-with-zero): no positive assertion; asserts unstable (nothing vs shape-only); verdict slop
- `the summary is produced` (vacuous): can_fail borderline (spread 0.44); asserts shape-only; verdict slop
- `the queue is not negative` (vacuous): no positive assertion; asserts shape-only; verdict slop
- `the schema is sound` (ambiguous): can_fail unstable (spread 0.54); asserts unstable (nothing vs shape-only); verdict slop
- `collects the graph nodes` (ambiguous): can_fail unstable (spread 0.96); asserts shape-only; verdict weak
- `computes the tax due` (name-only): no positive assertion; asserts shape-only; verdict slop
- `validates email addresses` (name-only): can_fail unstable (spread 0.80); asserts shape-only; verdict weak
- `sorts rows by name` (name-only): can_fail unstable (spread 0.53); asserts shape-only; verdict slop
- `rejects a stale token` (skipped): does not run; asserts unstable (nothing vs behaviour); verdict slop
- `parses a dotted key` (skipped): can_fail unstable (spread 0.51); does not run; verdict slop
- `saves the draft` (focused): does not run; verdict weak
- `loads the draft` (focused): can_fail borderline (spread 0.32); asserts unstable (hardcoded-data vs behaviour)
- `merges the options` (commented-out): no positive assertion; asserts nothing; verdict slop
- `rejects a blank name` (early-return): does not run; asserts nothing; verdict slop
- `normalise keeps the title text` (wrong-reason): asserts hardcoded-data; verdict slop
- `reports no booking for a free slot` (wrong-reason): no positive assertion
- `returns null for an unknown setting` (only-negative): no positive assertion
- `finds no imports in an empty file` (only-negative): no positive assertion
- `parses a well formed header` (only-negative): can_fail unstable (spread 0.70); no positive assertion; asserts nothing; verdict slop

Checks, in column order: `obs` observable, `cond` conditional, `iso` isolated, `ctl` controlled, `spec` specific, `name` named, `det` deterministic, `one` one_thing, `nm` name_matches, `res` resilient, `diag` diagnostic, `fix` fixture, `fast` fast, `read` readable, `magic` magic_number, `out` reads_output, `auto` automated, `rest` restores.
`+` clean, `-` the smell the check looks for, `.` unanswered. `can_fail` is the mean P(can fail) over three phrasings; `spread` above the band is instability.

