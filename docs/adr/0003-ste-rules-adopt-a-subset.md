# 0003: The Simplified Technical English rules adopt a subset of ASD-STE100

- Status: Accepted
- Date: 2026-09-01
- Deciders: Atle

## Context

`simplified-technical-english/ste-rules.md` builds on ASD-STE100 and names the
standard. The model knows the full standard from training, so the name alone
primes an agent to apply rules the file never adopted. The `ste-review`
subagent reads the rules file at run time, in whichever project it runs, and
no other file in this repo reaches it there. That file is a directive an agent
applies. Design history is not a directive.

## Decision

The rules file keeps a short guard: apply no other rule from the standard. The
guard names the two rejections an agent reintroduces unprompted, each with the
contrast example that shows the bad rewrite. This record holds every rejected
rule and the reason, so the rules file states only what to do.

## Rejected rules

These are real ASD-STE100 rules. The rules file does not adopt them.

- **The modal restriction** (approve only `can`, `will`, `must`, and rewrite
  `should` to `must`). It turns a soft default into a hard requirement and
  destroys the hedging an agent needs. `may have failed` is not `failed`.
- **An approved-word allowlist.** Flagging every word outside a fixed list fires
  constantly on ordinary prose, and it fights the advice to write in the words a
  reader actually uses. The guard stays silent on this one. Left unmentioned, an
  agent already picks plain words, and it reuses the vocabulary the codebase and
  the documentation established.
- **The ban on compound tenses.** It loses a state distinction that matters:
  `the job has completed` is not `the job completed`.
- **Cutting the rationale.** The rule "keep the reason where a reader needs
  judgement" replaces it.
- **American spelling.** The British English rule replaces it.

## Clause numbers

The rules file carried an `[ASD n.n]` tag per rule. A tag is a cross-reference
and nothing more, so it cost context in every session for no runtime value once
the file started loading unconditionally (ADR 0007). The mapping lives here.

| rule | clause |
| --- | --- |
| Delete the semicolon | 8.1 |
| No contraction | 4.2 |
| No Latin abbreviation | GR-6 |
| Use the verb, not the noun built from it | 3.7 |
| Use a single-word verb | 9.3 |
| At most 20 words in a procedure step | 5.1 |
| At most 25 words in a sentence of description | 6.3 |
| At most 6 sentences in a paragraph | 6.6 |
| One instruction per step | 5.2 |
| Start a step with the action | 5.3 |
| Put the condition first, then a comma, then the command | 5.4 |
| Put the warning before the step it guards | 7 |
| One term for one concept | 1.11 |
| Active voice, with the actor named | 3.6 |
| At most three nouns in a row | 2.1 |
| One topic per paragraph | 6.5 |
| Word counting: aside, compound, number, quote, code span | 8.5 to 8.7 |

## Consequences

- `ste-review` still learns which rules not to apply, because the guard travels
  with the rules file it reads at run time.
- The reasons live here, where a reader who wants them looks for a decision.
- A new rejection edits two places: this list always, and the guard when an
  agent is likely to reintroduce the rule.

## Alternatives considered

- **Keep the full section in the rules file.** Rejected: an agent reading the
  file to apply it does not need the argument for what it already says.
- **Move the whole section to a README.** Rejected: a README is no more
  reachable at run time than this record, and the repo keeps design rationale
  in `docs/adr/`.
- **Delete the section and keep no guard.** Rejected: the file names
  ASD-STE100, so a primed agent rewrites `should` to `must` and flags a
  compound tense. The guard is load-bearing.
