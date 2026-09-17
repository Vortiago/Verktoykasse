# 0004: The clean-code rules adopt a subset of Clean Code

- Status: Accepted
- Date: 2026-09-04
- Deciders: Atle

## Context

`clean-code/clean-code-rules.md` builds on Clean Code and names the book. The
model knows the book from training, so the name alone primes an agent to apply
rules the file never adopted. The file loads on a code-file touch, in whichever
project it runs, and no other file in this repo reaches it there. That file is a
directive an agent applies. Design history is not a directive.

Two forces beyond ADR 0003's shape it.

The file governs code, so a wrong rewrite breaks a gate rather than reading
oddly. A "comments are a failure" reading strips a type annotation, a checker
directive or a provenance stamp, and the gate then fails for a reason that looks
unrelated to the edit.

A rule written as a prohibition does not survive compaction. A path-scoped rule
reloads only on the next matching read, so until then the summary's paraphrase
is the only trace of it. Strip the negation from "do not add a docstring to
every function" and the instruction inverts.

## Decision

Every rule in the file names an action to take. A rule that exists to stop a
change reads as a **keep**, never as a prohibition, and a bare `Delete …`
headline is avoided because losing its qualifier leaves an executable
imperative.

The file closes on what it does not adopt: where the book goes further, keep the
code as its author wrote it. That statement names the two an agent reintroduces
most often, and it is the whole of what this repo says about the book's further
rules. **No list of rejected rules is kept**, here or anywhere: a rule named as
rejected reads to an agent as a rule this repo does not care about, which is not
what "we do not hold it as a hard limit" means. A rule worth naming is worth
writing in the rules file as an action to take.

Five rules in the file are this codebase's rather than the book's: edit the lines
the task names, a TODO carries an issue reference, keep the type annotation and
the published help, keep a comment a tool reads, and name a boolean as a
condition. The file names no chapter, so it claims no authorship it does not
have.

## Consequences

- An agent reading the file learns which rules not to apply, because the closing
  statement travels with the rules file it loads.
- A rule this repo declines is edited in one place, the rules file's closing
  statement, and only when an agent is likely to reintroduce it. There is no
  second list to keep in step.
- The book's reasoning for a rule this repo does not adopt is not recorded. That
  is the cost of the line above, and it is accepted: the book is the place to
  read the book.
- The keep-list is illustration, not a registry. Its headline is the general
  predicate, "keep a comment a tool reads", so a new directive in this repo
  needs no line in the rules file. A future maintainer who reads the table as
  exhaustive takes on a per-directive edit the predicate never asked for.

## Amendments

- **2026-09-17**: the `## Rejected rules` list was removed. It was read as
  licence rather than as nuance — an agent that found "a comment is a failure,
  so write none" under a *Rejected* heading concluded comment volume was not a
  concern here, and wrote a 37-line rationale essay atop a 146-line checker
  (`vanilla-web/tools/check-css-tokens.mjs`, since cut). The list said what this
  repo does not enforce as a hard limit; it was read as what this repo does not
  want. The closing statement in the rules file carries what an agent has to act
  on.

## Alternatives considered

- **A mechanical gate half**, a `check-comments.mjs` discovered by
  `vanilla-web/tools/check.mjs`. Rejected because comment *necessity* is a
  judgement, which is the load-bearing reason: measured on this tree, a
  section-marker regex and a commented-out-code regex both hit real code, and a
  journal regex hits test descriptions. `tsc --noEmit` with `noUnusedLocals` and
  `noUnusedParameters` already gates dead imports, locals and parameters. One
  rule is binary rather than judgement, "give a TODO an issue reference", and
  it is the honest candidate if a check is ever wanted: the repo's
  `vanilla-web/tools/js-scan.mjs` already separates a comment from a string
  literal, so the scaffolder at `vanilla-web/previews/new.mjs:60` that emits a
  TODO inside a string is not a false positive for it. Note that "a false block
  leaves an agent stuck" is *not* a reason here: `gate-allow:` and `gate: off`
  are this repo's escape hatches, and the rules file lists both.
- **A `clean-code-review` subagent.** Rejected: `code-review` and `/simplify`
  already run on a diff, and a third reviewer is the noise this file targets.
- **A committed `.claude/settings.json`.** Rejected: no settings key enables,
  imports or requires a rules file, so such a file would claim an enforcement it
  cannot deliver. `./install.sh` is what makes the rules apply.
- **A project `.claude/rules/` holding symlinks.** Rejected: it would make the
  repo self-enforcing with no install step, at the cost of a double load when
  the user-level copy is installed too, and a one-line text-file rule on a
  Windows checkout without `core.symlinks`.
- **Pointing `ste-review` at this file.** Rejected: the two rules govern
  different artefacts and name different sources. A link is cheap to add later
  and awkward to unpick once something depends on it.
