# 0004: The clean-code rules adopt a subset of Clean Code

- Status: Accepted
- Date: 2026-09-22
- Deciders: Atle

## Context

`clean-code/clean-code-rules.md` builds on Clean Code, and names neither the
book nor its author. The model knows the book from training, so the name alone
primes an agent to apply rules the file never adopted. A pointer to this record
primes the same way: an agent that follows it reads the rejected rules as
instructions. So the rules file names no source, no ADR and no third-party
skill. That file is a directive an agent applies. Design history is not a
directive, so it lives here.

Three forces beyond ADR 0003's shape it.

The file governs code, so a wrong rewrite breaks a gate rather than reading
oddly. A "comments are a failure" reading strips a type annotation, a checker
directive or a provenance stamp, and the gate then fails for a reason that looks
unrelated to the edit.

A rule written as a prohibition does not survive compaction. Strip the negation
from "do not add a docstring to every function" and the instruction inverts.

A rules file that only says what to delete teaches nothing. Measured across the
repo, every subtractive rule already held: zero commented-out code, zero step
labels, zero comments restating the next line. What drifted was shape.
`vanilla-web` carried 40 comment blocks of six lines or more, the longest 42,
while `matrix` and `statusline` stayed at one or two. An agent that obeyed the
file wrote nothing, or wrote an essay and passed every rule.

## Decision

**Every rule names an action to take.** A rule that exists to stop a change reads
as a **keep**, not as a prohibition. A bare `Delete ...` headline is avoided,
because an agent that loses its qualifier deletes too much.

**The file leads with what a comment answers**, in five shapes, each with an
example from this repo. A comment is short prose of at most four lines. Long
comments were the drift the file exists to stop. Longer reasoning goes in the
commit message or the project's documentation, because not every project keeps
ADRs. The file restates three STE rules for comments inline. It does not point
at `ste-rules.md`, which governs different artefacts.

**The file governs how work splits across files and folders.** A feature gets a
folder holding every part of it. Each variant gets its own file behind one shared
interface. At about 300 lines, a file is named to see whether it holds one thing
or two. `vanilla-components/components/` and `matrix/lib/terminal/` are the
examples.

**The file carries no `paths:` frontmatter and loads at session start.** Only a
Read arms a path-scoped rule. The write and edit tools arm nothing, so writing
code never loaded the file, and it reached five working sessions across 2851
transcripts. An unscoped file loads in the launch-time memory block instead,
under "IMPORTANT: These instructions OVERRIDE any default behavior", is re-sent
after every compaction, and is visible to `/code-review`. The cost is about 2000
tokens per session and per subagent spawn, cached. ADR 0003 records the same
decision for the STE file.

**The file names no source and states no rejection.** It names neither the book,
its author, this record, nor a third-party skill. An agent that meets a name, or
a pointer to a list of rejected rules, applies what it finds there. A "not
adopted" section turns into a list of things to do once its negation is lost.
This record holds every rejected rule and the reason.

**A problem met on the way is fixed now.** An agent defers what it finds to
"later", and later does not arrive. A note to the user gets lost in a long
reply, so the rule asks for the fix and nothing else. For the same reason, the
file has no rule for a TODO.

**The Boy Scout rule applies.** The agent leaves the code around its change
cleaner than it found it.

**A function is small, with few arguments.** The agent extracts each step into a
function named for the step, until each function does one job. It uses as few
arguments as it can. Zero is not the target, because zero arguments pushes
state into globals.

**A name says what a thing means, not its type.** The file gives no rule for a
private-member prefix, because the right prefix depends on the language.

**The keep-list names no bypass token.** A spelled-out `gate: off` or
`gate-allow:` in a file that loads in every session becomes an agent's first
move.

Three rules in the file are this codebase's rather than the book's: fix a
problem you find now, keep a comment a tool reads, and split the parse from the
read.

## Rejected rules

These are real Clean Code rules. The rules file does not adopt them.

- **One assert per test** (chapter 9). A test of a state change needs the before
  and the after in one test. The file adopts one concept per test instead.
- **A comment is a failure, so write none** (chapter 4). A constraint comment
  carries weight, and a type annotation is the type system, not prose. Delete
  `// @ts-check` and `tsc` stops reading the file. The keep-list in the rules
  file exists for this rejection.
- **Single Responsibility per class** (chapter 10). The module is the unit here.
  The file applies the principle to a file, through the 300-line check.
- **The stepdown rule and newspaper ordering** (chapters 3 and 5). This repo
  defines a helper before its first use, and reordering a file makes a diff
  nobody asked for.
- **Do not return null, do not pass null** (chapter 7). A nullable return is
  checked here: `@returns {T | null}` under `strict` and `checkJs`. A Special
  Case object would lose that check.

These are out of scope.

- **Command-query separation** (chapter 3): a useful default, and too easy to
  apply as a hard rule.
- **Extract a try or catch block into its own function** (chapter 3).
- **Formatting: line width, vertical distance, team rules** (chapter 5): a
  formatter owns these, not an agent.
- **Objects and data structures: the Law of Demeter, hybrids, DTOs**
  (chapter 6).
- **Boundaries, systems, emergence, concurrency** (chapters 8, 11, 12, 13).
- **Do not repeat yourself** (chapter 3): `/simplify` and `code-review` own
  reuse.

## Consequences

- An agent reading the file meets no rejected rule, so it has no negation to
  lose.
- The file sits in every session and every subagent, so its cost is paid whether
  or not the session writes code.
- The reasons live here, where a reader who wants them looks for a decision.
- A new rejection edits this list. It adds a keep to the rules file only when an
  agent is likely to reintroduce the rule.
- The keep-list is illustration, not a registry. Its headline is the general
  predicate, "keep a comment a tool reads", so a new directive in this repo needs
  no line in the rules file. A future maintainer who reads the table as
  exhaustive takes on a per-directive edit the predicate never asked for.
- The 40 long comment blocks are drift, not errors. Each is trimmed when its file
  is next touched, under the Boy Scout rule. Issue #99 tracks them.

## Alternatives considered

- **A mechanical gate half**, a `check-comments.mjs` discovered by
  `vanilla-web/tools/check.mjs`. Rejected because comment *necessity* is a
  judgement, which is the load-bearing reason: measured on this tree, a
  section-marker regex and a commented-out-code regex both hit real code, and a
  journal regex hits test descriptions. `tsc --noEmit` with `noUnusedLocals` and
  `noUnusedParameters` already gates dead imports, locals and parameters.
- **A `PreToolUse` check on the mechanical rules.** Rejected: more layers of
  guard than wanted, and every workable design needed an escape hatch. Do not
  answer "a false block leaves an agent stuck" with `gate-allow:` or `gate: off`.
  A documented bypass becomes an agent's first move rather than its last, so it
  stops the guard guarding.
- **A `SessionStart` hook re-seeding the rules after each compaction.** Rejected:
  an unscoped file is re-sent after every compaction already, with no machinery.
- **An output style, or `~/.claude/CLAUDE.md` carrying the rules.** Rejected: the
  rules load in the memory block themselves, above `CLAUDE.md`. An output style
  also replaces the built-in coding instructions and does not reach subagents.
- **A `clean-code-review` subagent.** Rejected: a reviewer built against rules
  that under-teach amplifies the wrong thing. Note that `code-review` and
  `/simplify` do not cover this gap, whatever their diff scope: one hunts
  correctness, the other reuse and efficiency, and neither asks whether a comment
  answers a question. Revisit once the current rules have run on real work.
- **A committed `.claude/settings.json`.** Rejected: no settings key enables,
  imports or requires a rules file, so such a file would claim an enforcement it
  cannot deliver. `./install.sh` is what makes the rules apply.
- **A project `.claude/rules/` holding symlinks.** Rejected: it would make the
  repo self-enforcing with no install step, at the cost of a double load when the
  user-level copy is installed too, and a one-line text-file rule on a Windows
  checkout without `core.symlinks`.
- **Pointing `ste-review` at this file.** Rejected: the two rules govern
  different artefacts and name different sources. The comment-register rule is
  restated inline instead.
