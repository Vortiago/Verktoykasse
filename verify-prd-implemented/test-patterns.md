# Test-guarding reference

Consulted from steps 4–5 of `SKILL.md`. Two parts: the catalogue of tests that *look* like guards but aren't, and the mutation recipe that proves a guard is real.

## What does NOT count as test-guarded

A test matching any pattern below is `testGuarded: no` (or `weak`) even though it is green. Name the pattern in your finding.

- **Tautology / self-reference.** Asserts a function against another call to the same production code: `assert(reader.output === extractImports(src))`. It guards *dispatch/plumbing*, not the behavior — it passes unchanged if the behavior's meaning silently changes. Fix: assert a **literal expected value**.
- **Vacuous / passes-with-zero.** Would pass if the feature produced nothing. A "Python imports are extracted and folded" test that only checks `commit.imports` is dispatched, never that an **edge resolves**, passes even when every edge is dropped. Demand a positive assertion on the **output value** the story is about.
- **Shape-not-value.** Asserts the type/length/keys of a result but not its content (`assert(Array.isArray(roads))`, `assert(result.length === 3)`). Survives a result that is the right shape and wrong everywhere.
- **Name-only.** A file/`test()` named for the behavior whose body asserts something adjacent and trivial. The name is documentation, not a guard.
- **Skipped / disabled / focused.** `.skip`, `xit`, `it.only` elsewhere narrowing the run, commented-out asserts, an early `return`. Grep for these in the suites you trust.
- **Passes for the wrong reason.** The assertion holds, but not because of the code it claims to test — a virtual-repo-boundary test that passes because the target isn't born yet (commit ordering), not because the boundary keying works. Caught only by the mutation check (step 5): break the *claimed* mechanism; if the test stays green, this is the pattern.
- **No negative/positive pair.** Only-negative tests ("no edge here") pass against a resolver that *always* returns null. Require at least one **positive** assertion (the edge that must exist) beside the negatives.

## The mutation check (step 5)

A guard is real only if it goes red when its behavior breaks. Prove it:

1. **Back up** the file you will mutate (`cp file file.bak`) so revert is exact.
2. **Inject one targeted fault** into the specific code path the unit depends on — not a syntax error. Make the behavior wrong, minimally:
   - a resolver/handler: `return null;` (or `return [];`) as its first line;
   - a classifier: flip the branch it selects;
   - a threshold/constant: shift it past the boundary the test sits on;
   - a directed/typed output: swap the direction or the type label.
3. **Run the suite** and read the per-test results.
4. **Confirm the *named* test fails** — the specific assertion you cited in step 4, not merely "something failed". If you predicted 3 tests guard this unit, confirm those 3 go red. Note which bit and which (tellingly) did not.
5. **Revert** from the backup and re-run to confirm green is restored. Leave the tree exactly as found.

Batch independent mutations in one pass when they touch different code paths (kill resolver A and resolver B together, confirm A-tests and B-tests fail in disjoint sets) — this also proves the guards are **specific**, not a blanket that fails on any change.

A unit whose guard **stays green under its mutation** is unguarded: downgrade to `testGuarded: no` and list it as a blocking gap.

## Evidence rubric (step 7)

Rank the evidence you cite per story, strongest first:
1. **Mutation-confirmed assertion** — "deps test X went red when resolver Y was stubbed" (file:line of both).
2. **Asserting test on the output value** through the public interface (not mutation-checked).
3. **Code location only** — implemented, no real guard. → at best `partial`.
4. **Issue/PR says so** — not evidence. Never the basis for `covered: yes`.

For the matrix, prefer tier 1; a story resting on tier 3–4 is `partial` or `no`, never `yes`.
