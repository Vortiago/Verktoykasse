# 0003: The Simplified Technical English rules adopt a subset of ASD-STE100

- Status: Accepted
- Date: 2026-09-01
- Deciders: Atle

## Context

`simplified-technical-english/ste-rules.md` builds on ASD-STE100 and names the
standard. The model knows the full standard from training, so the name alone
primes an agent to apply rules the file never adopted. The `ste-review`
subagent reads the rules file at run time, in whichever project it runs, and
no other file in this repo reaches it there. The rules file also loads into
context on every markdown touch, so every line in it has a recurring token
cost.

## Decision

The rules file keeps a short guard: apply no other rule from the standard. The
guard names the three rejections an agent is most likely to reintroduce, each
with the contrast example that shows the bad rewrite. This record holds every
rejected rule and the reason, so the rationale costs no context.

## Rejected rules

These are real ASD-STE100 rules. The rules file does not adopt them.

- **The modal restriction** (approve only `can`, `will`, `must`, and rewrite
  `should` to `must`). It turns a soft default into a hard requirement and
  destroys the hedging an agent needs. `may have failed` is not `failed`.
- **An approved-word allowlist.** Flagging every word outside a fixed list fires
  constantly on ordinary prose, and it fights the advice to write in the words a
  reader actually uses.
- **The ban on compound tenses.** It loses a state distinction that matters:
  `the job has completed` is not `the job completed`.
- **Cutting the rationale.** The rule "keep the reason where a reader needs
  judgement" replaces it.
- **American spelling.** The British English rule replaces it.

## Consequences

- `ste-review` still learns which rules not to apply, because the guard travels
  with the rules file it reads at run time.
- The reasons live here and cost no context.
- A new rejection edits two places: this list always, and the guard when an
  agent is likely to reintroduce the rule.

## Alternatives considered

- **Keep the full section in the rules file.** Rejected: the reasons are design
  history, and the file pays their token cost on every markdown touch.
- **Move the whole section to a README.** Rejected: a README is no more
  reachable at run time than this record, and the repo keeps design rationale
  in `docs/adr/`.
- **Delete the section and keep no guard.** Rejected: the file names
  ASD-STE100, so a primed agent rewrites `should` to `must` and flags a
  compound tense. The guard is load-bearing.
