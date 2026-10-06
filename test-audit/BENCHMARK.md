# test-audit benchmark

The corpus scores a decision model on how well it separates a real test guard
from fake safety. Each run records one entry per case, worst verdict first, with
the result of every check and the reasons a case escalates.

Date: 2026-10-06.

Command:

```sh
TEST_AUDIT_CONCURRENCY=3 TEST_AUDIT_TIMEOUT_MS=600000 node cli.mjs --selftest --benchmark \
  --targets "http://koishi.tail6defbc.ts.net:8090|qwen3.8-flash-next-mtp"
```

## qwen3.8-flash-next-mtp

Endpoint `http://koishi.tail6defbc.ts.net:8090`. 62 cases, 62 calls, 54914 tokens.

can_fail agreement: 38/39 resolved (97%). Silent passes: 0. Mixed routed: 5/5. False positives: 4/18. deterministic: 6/8.

defects escalated: ambiguous 5/5, commented-out 2/2, early-return 1/1, focused 2/2, hardcoded-data 2/2, interaction-only 3/3, name-only 4/4, only-negative 4/4, passes-with-zero 2/2, self-reference 3/3, shape-only 4/4, skipped 3/3, tautology 2/2, vacuous 2/2, wrong-reason 2/2

Checks, in order: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores.
Each check is clean, the smell it looks for, or unanswered. `can_fail` is the mean P(can fail) over three phrasings; a `!` marks a spread above the band.

### `computes the tax` — name-only

- can_fail 0.03 (spread 0.09) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, one_thing, resilient, fixture, fast, magic_number, reads_output, automated, restores
- smells: specific, named, name_matches, diagnostic, readable
- **verdict: slop** · needs eyes: no positive assertion; asserts shape-only; verdict slop

### `computes the tax due` — name-only

- can_fail 0.01 (spread 0.03) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, one_thing, resilient, fixture, fast, magic_number, reads_output, automated, restores
- smells: specific, named, name_matches, diagnostic, readable
- **verdict: slop** · needs eyes: no positive assertion; asserts shape-only; verdict slop

### `events are dispatched` — passes-with-zero

- can_fail 0.01 (spread 0.01) · asserts nothing · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, one_thing, resilient, fixture, fast, magic_number, automated, restores
- smells: specific, named, name_matches, diagnostic, readable, reads_output
- **verdict: slop** · needs eyes: no positive assertion; asserts unstable (nothing vs shape-only); verdict slop

### `handles overflow` — skipped

- can_fail 0.10 (spread 0.16) · asserts behaviour · runs no
- clean: observable, conditional, isolated, controlled, specific, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: named
- **verdict: slop** · needs eyes: does not run; verdict slop

### `imports are folded` — passes-with-zero

- can_fail 0.02 (spread 0.07) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, controlled, named, deterministic, one_thing, resilient, fixture, fast, magic_number, reads_output, automated, restores
- smells: specific, name_matches, diagnostic, readable
- **verdict: slop** · needs eyes: no positive assertion; asserts shape-only; verdict slop

### `merges the options` — commented-out

- can_fail 0.00 (spread 0.00) · asserts nothing · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, one_thing, resilient, diagnostic, fixture, fast, magic_number, automated, restores
- smells: specific, named, name_matches, readable, reads_output
- **verdict: slop** · needs eyes: no positive assertion; asserts nothing; verdict slop

### `normalise keeps the title text` — wrong-reason

- can_fail 0.05 (spread 0.05) · asserts hardcoded-data · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, diagnostic, fixture, fast, readable, magic_number, automated, restores
- smells: name_matches, resilient, reads_output
- **verdict: slop** · needs eyes: asserts hardcoded-data; verdict slop

### `parse is stable` — self-reference

- can_fail 0.00 (spread 0.01) · asserts nothing · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, one_thing, resilient, diagnostic, fixture, fast, magic_number, reads_output, automated, restores
- smells: specific, named, name_matches, readable
- **verdict: slop** · needs eyes: asserts nothing; verdict slop

### `parses a dotted key` — skipped

- can_fail 0.39! (spread 0.51) · asserts behaviour · runs no
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: slop** · needs eyes: can_fail unstable (spread 0.51); does not run; verdict slop

### `parses a well formed header` — only-negative

- can_fail 0.25! (spread 0.70) · asserts nothing · runs yes
- clean: observable, conditional, isolated, controlled, named, deterministic, one_thing, resilient, diagnostic, fixture, fast, readable, magic_number, automated, restores
- smells: specific, name_matches, reads_output
- **verdict: slop** · needs eyes: can_fail unstable (spread 0.70); no positive assertion; asserts nothing; verdict slop

### `parses config` — commented-out

- can_fail 0.00 (spread 0.00) · asserts nothing · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, one_thing, resilient, fixture, fast, magic_number, automated, restores
- smells: specific, named, name_matches, diagnostic, readable, reads_output
- **verdict: slop** · needs eyes: no positive assertion; asserts nothing; verdict slop

### `reader round trips` — self-reference

- can_fail 0.00 (spread 0.01) · asserts nothing · runs yes
- clean: observable, conditional, isolated, deterministic, one_thing, resilient, diagnostic, fixture, fast, magic_number, automated, restores
- smells: controlled, specific, named, name_matches, readable, reads_output
- **verdict: slop** · needs eyes: asserts nothing; verdict slop

### `rejects a blank name` — early-return

- can_fail 0.01 (spread 0.01) · asserts nothing · runs no
- clean: observable, isolated, controlled, specific, named, deterministic, one_thing, resilient, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: conditional, name_matches, diagnostic
- **verdict: slop** · needs eyes: does not run; asserts nothing; verdict slop

### `rejects a stale token` — skipped

- can_fail 0.04 (spread 0.08) · asserts nothing · runs no
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: slop** · needs eyes: does not run; asserts unstable (nothing vs behaviour); verdict slop

### `returns a list of routes` — shape-only

- can_fail 0.27! (spread 0.80) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, controlled, named, deterministic, one_thing, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: specific, name_matches
- **verdict: slop** · needs eyes: can_fail unstable (spread 0.80); asserts shape-only; verdict slop

### `saves the user` — wrong-reason

- can_fail 0.47! (spread 0.59) · asserts interaction-only · runs yes
- clean: conditional, isolated, controlled, named, deterministic, one_thing, fixture, fast, magic_number, automated
- smells: observable, specific, name_matches, resilient, diagnostic, readable, reads_output, restores
- **verdict: slop** · needs eyes: can_fail unstable (spread 0.59); asserts interaction-only; verdict slop

### `sorts rows by name` — name-only

- can_fail 0.18! (spread 0.53) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, controlled, named, deterministic, one_thing, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: specific, name_matches
- **verdict: slop** · needs eyes: can_fail unstable (spread 0.53); asserts shape-only; verdict slop

### `taxes the standard rate` — hardcoded-data

- can_fail 0.12 (spread 0.19) · asserts hardcoded-data · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, resilient, diagnostic, fixture, fast, magic_number, reads_output, automated, restores
- smells: name_matches, readable
- **verdict: slop** · needs eyes: asserts hardcoded-data; verdict slop

### `the build is green` — tautology

- can_fail 0.00 (spread 0.00) · asserts nothing · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, one_thing, resilient, diagnostic, fixture, fast, readable, magic_number, automated, restores
- smells: specific, named, name_matches, reads_output
- **verdict: slop** · needs eyes: asserts nothing; verdict slop

### `the queue is not negative` — vacuous

- can_fail 0.03 (spread 0.02) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, controlled, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, magic_number, reads_output, automated, restores
- smells: specific, readable
- **verdict: slop** · needs eyes: no positive assertion; asserts shape-only; verdict slop

### `the schema is sound` — ambiguous

- can_fail 0.19! (spread 0.54) · asserts nothing · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, diagnostic, fixture, fast, automated, restores
- smells: specific, named, one_thing, name_matches, resilient, readable, magic_number, reads_output
- **verdict: slop** · needs eyes: can_fail unstable (spread 0.54); asserts unstable (nothing vs shape-only); verdict slop

### `the summary is produced` — vacuous

- can_fail 0.16! (spread 0.44) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, one_thing, resilient, diagnostic, fixture, fast, magic_number, reads_output, automated, restores
- smells: specific, named, name_matches, readable
- **verdict: slop** · needs eyes: can_fail borderline (spread 0.44); asserts shape-only; verdict slop

### `the two totals match` — self-reference

- can_fail 0.00 (spread 0.00) · asserts nothing · runs yes
- clean: observable, conditional, isolated, controlled, named, deterministic, one_thing, resilient, diagnostic, fixture, fast, reads_output, automated, restores
- smells: specific, name_matches, readable, magic_number
- **verdict: slop** · needs eyes: asserts nothing; verdict slop

### `the world is sane` — tautology

- can_fail 0.00 (spread 0.00) · asserts nothing · runs yes
- clean: conditional, isolated, controlled, deterministic, one_thing, resilient, diagnostic, fixture, fast, readable, magic_number, automated, restores
- smells: observable, specific, named, name_matches, reads_output
- **verdict: slop** · needs eyes: asserts nothing; verdict slop

### `the world is sane` — ambiguous

- can_fail 0.01 (spread 0.01) · asserts nothing · runs yes
- clean: conditional, isolated, controlled, deterministic, diagnostic, fixture, fast, magic_number, automated, restores
- smells: observable, specific, named, one_thing, name_matches, resilient, readable, reads_output
- **verdict: slop** · needs eyes: asserts nothing; verdict slop

### `builds the graph` — ambiguous

- can_fail 0.34! (spread 0.96) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, one_thing, resilient, diagnostic, fixture, fast, reads_output, automated, restores
- smells: specific, named, name_matches, readable, magic_number
- **verdict: weak** · needs eyes: can_fail unstable (spread 0.96); asserts shape-only; verdict weak

### `builds three steps` — shape-only

- can_fail 0.88 (spread 0.22) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, controlled, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, reads_output, automated, restores
- smells: specific, magic_number
- **verdict: weak** · needs eyes: asserts shape-only; verdict weak

### `collects the graph nodes` — ambiguous

- can_fail 0.33! (spread 0.96) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, one_thing, resilient, diagnostic, fixture, fast, reads_output, automated, restores
- smells: specific, named, name_matches, readable, magic_number
- **verdict: weak** · needs eyes: can_fail unstable (spread 0.96); asserts shape-only; verdict weak

### `forwards the payload` — interaction-only

- can_fail 0.55! (spread 0.63) · asserts interaction-only · runs yes
- clean: conditional, isolated, controlled, named, deterministic, one_thing, diagnostic, fixture, fast, readable, magic_number, reads_output, automated
- smells: observable, specific, name_matches, resilient, restores
- **verdict: weak** · needs eyes: can_fail unstable (spread 0.63); asserts interaction-only; verdict weak

### `notifies the listener` — interaction-only

- can_fail 0.76! (spread 0.52) · asserts interaction-only · runs yes
- clean: conditional, isolated, controlled, named, deterministic, one_thing, name_matches, diagnostic, fixture, fast, magic_number, automated
- smells: observable, specific, resilient, readable, reads_output, restores
- **verdict: weak** · needs eyes: can_fail unstable (spread 0.52); asserts interaction-only; verdict weak

### `planner returns roads` — shape-only

- can_fail 0.63! (spread 0.85) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, one_thing, resilient, diagnostic, fixture, fast, reads_output, automated, restores
- smells: specific, named, name_matches, readable, magic_number
- **verdict: weak** · needs eyes: can_fail unstable (spread 0.85); asserts shape-only; verdict weak

### `publishes twice` — interaction-only

- can_fail 0.95 (spread 0.11) · asserts interaction-only · runs yes
- clean: conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, diagnostic, fixture, fast, readable, magic_number, automated
- smells: observable, resilient, reads_output, restores
- **verdict: weak** · needs eyes: asserts interaction-only; verdict weak

### `retries once` — ambiguous

- can_fail 0.79! (spread 0.41) · asserts interaction-only · runs yes
- clean: conditional, isolated, controlled, specific, named, deterministic, one_thing, diagnostic, fixture, fast, magic_number, automated, restores
- smells: observable, name_matches, resilient, readable, reads_output
- **verdict: weak** · needs eyes: can_fail borderline (spread 0.41); no positive assertion; asserts interaction-only; verdict weak

### `saves the draft` — focused

- can_fail 0.97 (spread 0.05) · asserts behaviour · runs no
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: weak** · needs eyes: does not run; verdict weak

### `the remote catalogue lists the widget` — non-deterministic

- can_fail 0.84 (spread 0.20) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, specific, named, one_thing, name_matches, resilient, diagnostic, fixture, readable, magic_number, reads_output, automated, restores
- smells: controlled, deterministic, fast
- **verdict: weak** · needs eyes: verdict weak

### `the retry lands within the window` — non-deterministic

- can_fail 0.76! (spread 0.60) · asserts behaviour · runs yes
- clean: conditional, isolated, specific, named, one_thing, name_matches, diagnostic, fixture, reads_output, automated
- smells: observable, controlled, deterministic, resilient, fast, readable, magic_number, restores
- **verdict: weak** · needs eyes: can_fail unstable (spread 0.60); asserts unstable (behaviour vs shape-only); verdict weak

### `the token has not expired yet` — non-deterministic

- can_fail 0.87! (spread 0.28) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, specific, named, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: controlled, deterministic
- **verdict: weak** · needs eyes: can_fail borderline (spread 0.28); verdict weak

### `validates email addresses` — name-only

- can_fail 0.69! (spread 0.80) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, controlled, deterministic, one_thing, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: specific, named, name_matches
- **verdict: weak** · needs eyes: can_fail unstable (spread 0.80); asserts shape-only; verdict weak

### `debounce fires once` — non-deterministic

- can_fail 0.99 (spread 0.02) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, specific, named, one_thing, name_matches, resilient, diagnostic, fixture, readable, reads_output, automated, restores
- smells: controlled, deterministic, fast, magic_number
- **verdict: good**

### `loads the draft` — focused

- can_fail 0.84! (spread 0.32) · asserts hardcoded-data · runs yes
- clean: observable, conditional, isolated, controlled, specific, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: named
- **verdict: good** · needs eyes: can_fail borderline (spread 0.32); asserts unstable (hardcoded-data vs behaviour)

### `loads the profile fields` — shape-only

- can_fail 0.97 (spread 0.07) · asserts shape-only · runs yes
- clean: observable, conditional, isolated, specific, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: controlled, named
- **verdict: good** · needs eyes: asserts shape-only

### `reports no booking for a free slot` — wrong-reason

- can_fail 0.97 (spread 0.06) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: good** · needs eyes: no positive assertion

### `resolves the status labels` — hardcoded-data

- can_fail 0.87! (spread 0.30) · asserts hardcoded-data · runs yes
- clean: observable, conditional, isolated, controlled, specific, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: named
- **verdict: good** · needs eyes: can_fail borderline (spread 0.30); asserts hardcoded-data

### `the sorter keeps every random value` — non-deterministic

- can_fail 0.96 (spread 0.06) · asserts hardcoded-data · runs yes
- clean: observable, conditional, isolated, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: controlled
- **verdict: good** · needs eyes: asserts unstable (hardcoded-data vs behaviour)

### `add handles negatives` — clean

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: strong**

### `builds a job with the given name` — wrong-reason

- can_fail 1.00 (spread 0.01) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: strong**

### `converts minutes to seconds` — clean

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: strong**

### `creating a user validates, stores and notifies` — eager

- can_fail 0.99 (spread 0.02) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: one_thing
- **verdict: strong**

### `finds no imports in an empty file` — only-negative

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: strong** · needs eyes: no positive assertion

### `formats a receipt line` — clean

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: strong**

### `no edge for a comment` — only-negative

- can_fail 0.98 (spread 0.04) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: strong** · needs eyes: no positive assertion

### `regression #42: a single import resolves` — clean

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: strong**

### `regression #77: a trimmed name keeps its inner spaces` — clean

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: strong**

### `returns null for an unknown setting` — only-negative

- can_fail 1.00 (spread 0.01) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: strong** · needs eyes: no positive assertion

### `reverses a string` — clean

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: strong**

### `slugs a display name` — clean

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: strong**

### `store round trips a value` — clean

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated
- smells: controlled, restores
- **verdict: strong**

### `the cache returns a stored value` — clean

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated
- smells: restores
- **verdict: strong**

### `the metric keys keep their insertion order` — non-deterministic

- can_fail 0.99 (spread 0.01) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, named, deterministic, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- **verdict: strong**

### `the pipeline parses, formats and lints` — eager

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, controlled, specific, deterministic, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: named, one_thing
- **verdict: strong**

### `the server answers health` — clean

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, specific, named, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: controlled, deterministic
- **verdict: strong**

### `the service reports its version` — clean

- can_fail 1.00 (spread 0.00) · asserts behaviour · runs yes
- clean: observable, conditional, isolated, specific, named, one_thing, name_matches, resilient, diagnostic, fixture, fast, readable, magic_number, reads_output, automated, restores
- smells: controlled, deterministic
- **verdict: strong**
