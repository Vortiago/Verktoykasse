---
name: verify-prd-implemented
description: Verify a PRD's user stories are each implemented AND test-guarded before closing it — maps every story to the code that does it and the assertion that guards it, mutation-checks the load-bearing guards, and returns a close/no-close verdict.
disable-model-invocation: true
---

Use this before closing a PRD, epic, or umbrella issue whose sub-issues are "all done". The job is to **disprove "done"**, not confirm it.

## The one principle

**A passing test suite is not evidence of coverage.** A green suite tells you nothing about *which* behaviors are guarded — only that whatever is asserted still holds. A test guards a behavior only if it turns **red when that behavior breaks**. The default failure mode this skill exists to catch is the *plausible-but-vacuous* test: a file named for a behavior that would still pass if the behavior were deleted. Coverage is proven **per story**, by an assertion you have watched go red — never by a suite-level pass.

Two traps recur and you must check for both separately:
- **Implemented but unguarded** — the code works, but no test would notice if it stopped.
- **Guarded-looking but not implemented** — a test exists and passes, but the behavior is non-functional and the test passes for the wrong reason (tautology, asserts a near-miss, asserts shape not value). The extractor works, dispatch works, every unit test is green — and the end-to-end edge it was all for resolves to nothing, with no test asserting that edge.

## Process

Do the steps in order. Each ends on a **checkable completion criterion** — do not advance until it is met. Do not trust the issue tracker's state, a checklist, or a previous agent's summary; verify in the code.

### 1. Extract the acceptance units

Read the PRD (GitHub issue, markdown file, or this conversation — whichever was named). Produce a **numbered list of every atomic acceptance unit**: each user story, each acceptance-criterion checkbox, each "Implementation Decision" that asserts observable behavior. Phrase each as a *checkable behavior* ("a PHP `use` resolves to the imported file"), not a feature area. List **Out-of-Scope** items separately — they are not gaps.

**Completion criterion:** every story/criterion in the PRD appears exactly once in the list or in Out-of-Scope; none dropped, none merged.

### 2. Map units to the work, but distrust "closed"

For each unit, find the sub-issue(s)/PR(s)/commits that claim to deliver it and their state. **A closed issue is a claim, not proof.** Record one specific red flag if present: a **closed issue whose own acceptance checkboxes are still unchecked** — corroboration that the work was waved through (it is a signal, never the basis; the code decides).

**Completion criterion:** every unit has a "claimed by" pointer (or "no claim found"), and any closed-with-unchecked-boxes issue is noted.

### 3. Verify implementation in code

For each unit, find the code that delivers it and cite `file:line`. Distinguish **"the seam exists"** from **"the behavior is wired end-to-end"**: trace the full path from input to observable output. A unit is `implemented: no` if any link in that path drops the result (e.g. a resolver that returns null for the language the story is about), even when every component in isolation looks present.

**Completion criterion:** each unit is `implemented: yes | partial | no` with a code citation for "yes/partial" and the broken link named for "partial/no".

### 4. Verify each unit is test-guarded

For each unit, find the **single assertion that would fail if the behavior regressed**, and quote it with its location. Apply the bar in [`test-patterns.md`](test-patterns.md): reject tautological, vacuous, shape-only, skipped, and passes-for-the-wrong-reason tests — a test that matches one of those patterns is `testGuarded: no` even though it is green. A unit needs a test that asserts the **actual output value through the public interface** (the resolved edge, the rendered string), not that two pieces of plumbing agree.

**Completion criterion:** each unit is `testGuarded: yes | weak | no`; every "yes" names the assertion (file:line + quote) that protects it.

### 5. Mutation-check the load-bearing guards

This is the step that separates this skill from a reading exercise. For each unit you marked `testGuarded: yes`, **break the implementation and confirm the guard goes red.** Follow the recipe in [`test-patterns.md`](test-patterns.md): inject a fault into the specific code path, run the suite, confirm the *named* test fails, then **revert**. A guard that stays green under its mutation does not guard — downgrade it to `no` and record it as a gap.

**Completion criterion:** every `testGuarded: yes` unit has either a mutation-confirmation (which test went red under which injected fault) or an explicit, justified note why a mutation was not run. No "yes" survives unverified.

### 6. Run the suites for real

Run the project's test command(s) and record the **actual exit code** per suite. A red suite blocks closing regardless of the per-story analysis. Remember the principle: a green suite does **not** upgrade any `testGuarded` verdict — coverage was decided in steps 4–5.

**Completion criterion:** every relevant suite has a recorded command + exit code; failures are listed.

### 7. Synthesize the verdict

Produce a **per-story matrix**: each unit → covered (`yes`/`partial`/`no`) with its strongest single piece of evidence (a mutation-confirmed assertion location beats a code location). Then: count units that are `implemented: yes` AND `testGuarded: yes` (post-mutation); list every **blocking gap** (a story with no working behavior or no real guard) separately from **non-blocking nits**; give a **CLOSE / DO-NOT-CLOSE** recommendation whose rationale is grounded in test-guarding evidence, not in the suite passing.

**Completion criterion:** every unit has a verdict + evidence; the recommendation names the exact gaps that block it (or states none remain).

## Scaling with a workflow

When the PRD has more units than fit one context (a dozen+ stories, several languages/subsystems), fan out steps 3–5 with the **Workflow tool**: one verifier per cluster of related stories, each followed by an **adversarial skeptic** prompted to *refute* the verifier (hunt vacuous tests, claimed-but-unguarded behaviors, stories passing for the wrong reason), then a synthesis agent for step 7. Give each agent the bar from [`test-patterns.md`](test-patterns.md) and require it to mutation-check (step 5), not just read. Pipeline the clusters so each skeptic runs as soon as its verifier returns. Solo is fine for a small PRD — the steps are identical; the workflow only parallelizes them.
