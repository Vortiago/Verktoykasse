# 0003: The Simplified Technical English rules adopt a subset of ASD-STE100

- Status: Accepted
- Date: 2026-09-22
- Deciders: Atle

## Context

`simplified-technical-english/ste-rules.md` builds on ASD-STE100, and names
neither the standard nor this record. The model knows the full standard from
training, so the name alone primes an agent to apply rules the file never
adopted. A pointer to this record primes the same way. The `ste-review`
subagent reads the rules file at run time, in whichever project it runs, and
no other file in this repo reaches it there. That file is a directive an agent
applies. Design history is not a directive.

## Decision

**The file carries no `paths:` frontmatter and loads at session start.** Only a
Read arms a path-scoped rule. The write and edit tools arm nothing, so writing
prose never loaded the file: across 2851 transcripts it reached zero working
sessions. An unscoped file loads in the launch-time memory block instead, under
"IMPORTANT: These instructions OVERRIDE any default behavior", and is re-sent
after every compaction. That block instructs Claude rather than describing a
file, so the rules reach four surfaces: a markdown file, a plan file, a commit
or PR body, and Claude's own replies. The cost is about 1100 tokens per session
and per subagent spawn, cached. ADR 0004 records the same decision for the
clean-code file.

**Every rule says what to write.** A rule written as "no X" names the thing it
forbids, and an agent that loses the "no" writes X. So `No em dash` becomes "use
a comma, a colon or two sentences where an em dash would go". The file states
no rejected rule. Two rules keep what an agent would otherwise remove: the word
that says how sure you are, and a tense that describes a state. This record
holds every rejected rule and the reason.

**The Boy Scout rule applies to text.** The agent applies the rules to the text
around its change too, as the clean-code rules do for code.

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
- **Cutting the rationale.** The rule "give the reason when the reader must
  judgement" replaces it.
- **American spelling.** The British English rule replaces it.

## Clause numbers

A tag is a cross-reference and nothing more, so it costs context in every
session for no runtime value. The mapping lives here instead of in the rules
file.

| rule | clause |
| --- | --- |
| Use two sentences where a semicolon would go | 8.1 |
| Write the full form of a verb | 4.2 |
| Write the English words for a Latin abbreviation | GR-6 |
| Use the verb, not the noun made from it | 3.7 |
| Use a one-word verb | 9.3 |
| At most 20 words in a procedure step | 5.1 |
| At most 25 words in a sentence of description | 6.3 |
| At most 6 sentences in a paragraph | 6.6 |
| Give one instruction in each step | 5.2 |
| Start a step with its verb | 5.3 |
| Put the condition first, then a comma, then the command | 5.4 |
| Put the warning before the step it is for | 7 |
| Use one word for one thing | 1.11 |
| Use the active voice, and name who does it | 3.6 |
| Use at most three nouns in a row | 2.1 |
| Keep one topic in each paragraph | 6.5 |
| Word counting: aside, compound, number, quote, code span | 8.5 to 8.7 |

## Consequences

- `ste-review` reads no list of rejected rules at run time.
- The reasons live here, where a reader who wants them looks for a decision.
- A new rejection edits this list. It adds a rule to the rules file only when an
  agent is likely to bring the rejected rule back.

## Alternatives considered

- **Keep the full section in the rules file.** Rejected: an agent reading the
  file to apply it does not need the argument for what it already says.
- **Move the whole section to a README.** Rejected: a README is no more
  reachable at run time than this record, and the repo keeps design rationale
  in `docs/adr/`.
- **A guard that names the standard and prohibits its extra rules.** Rejected:
  the name primes the rules, and the prohibition inverts once its negation is
  lost. The two keep rules do the same work with neither risk.
