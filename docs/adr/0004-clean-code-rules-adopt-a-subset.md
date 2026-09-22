# 0004: The clean-code rules adopt a subset of Clean Code

- Status: Accepted
- Date: 2026-09-22
- Deciders: Atle

## Context

`clean-code/clean-code-rules.md` builds on Clean Code and names the book. The
model knows the book from training, so the name alone primes an agent to apply
rules the file never adopted. That file is a directive an agent applies. Design
history is not a directive, so it lives here.

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
as a **keep**, never as a prohibition, and a bare `Delete ...` headline is
avoided, because losing its qualifier leaves an executable imperative.

**The file leads with what a comment answers**, in five shapes, each with a real
example from this repo. A comment is prose in the STE register and runs to about
four lines. Reasoning that needs more room belongs in an ADR the comment cites.
That restates three STE rules inline rather than pointing at `ste-rules.md`,
which governs different artefacts.

**The file governs how work splits across files and folders.** A feature gets a
folder holding every part of it, each variant gets its own file behind one shared
interface, and at about 300 lines a file is named to see whether it holds one
thing or two. `vanilla-components/components/` and `matrix/lib/terminal/` are the
exemplars. Reuse and design stay with `code-review` and `/simplify`, which run on
a diff.

**The file carries no `paths:` frontmatter and loads at session start.** Only a
Read arms a path-scoped rule. The write and edit tools arm nothing, so writing
code never loaded the file, and it reached five working sessions across 2851
transcripts. An unscoped file loads in the launch-time memory block instead,
under "IMPORTANT: These instructions OVERRIDE any default behavior", is re-sent
after every compaction, and is visible to `/code-review`. The cost is about 1900
tokens per session and per subagent spawn, cached. ADR 0003 records the same
decision for the STE file.

**The file closes on what it does not adopt.** That statement names the two rules
an agent reintroduces most often. This record holds every rejected rule and the
reason, so the rules file states only what to do.

Six rules in the file are this codebase's rather than the book's: edit the lines
the task names, a TODO carries an issue reference, keep the type annotation and
the published help, keep a comment a tool reads, name a boolean as a condition,
and mark a module-private with the prefix its language uses. The file names no
chapter, so it claims no authorship it does not have.

## Rejected rules

These are real Clean Code rules. The rules file does not adopt them. The first
nine are the ones an agent reintroduces unprompted.

- **A function is small** (chapter 3: two to four lines, at most a screen). It
  splits one job into fragments a reader reassembles. A forty-line function that
  does one thing stays whole, rather than becoming `renderPart1`, `Part2`,
  `Part3`. A function has no length rule here. The 300-line check under
  `Shape of a file tree` is a check on a file, not a budget for a function.
- **At most three arguments, zero ideal** (chapter 3). Three named parameters
  read better than the options object a count forces: `render(el, data, signal)`
  is not improved by `render({ el, data, signal })`.
- **One assert per test** (chapter 9). A test of a state change needs the before
  and the after in one test, or each half is blind.
- **A comment is a failure, so write none** (chapter 4, the opening argument). A
  constraint comment is load-bearing, and a type annotation is the type system
  rather than prose. Delete `// @ts-check` and `tsc` silently stops reading the
  file. The keep-list in the rules file exists for this rejection.
- **Single Responsibility per class or line** (chapter 10). The module is the
  unit here: `render.js` states one identity, and each function inside it does
  not need its own. The rules file applies the principle at file level, through
  the 300-line check.
- **The stepdown rule and newspaper ordering** (chapters 3 and 5). This repo
  defines a helper before its first use, `nfmt` at `vanilla-web/format.js:22`
  used at `:41`, and reordering a file makes a diff nobody asked for.
- **The Boy Scout rule** (the introduction: leave the file cleaner than you
  found it). It turns every read into a sweep: open `render.js` to fix one bug,
  rewrite its header nobody asked about. The `## Scope` rule replaces it.
- **Avoid encodings, no member prefix** (chapter 2). `_helper` marks a
  module-private function in JavaScript, which has no keyword for one:
  `_isInteractive`, `_holdCause`, `_dropPending` and `_flushRegion` in
  `vanilla-web/render.js`. The rules file states this as a rule.
- **Do not return null, do not pass null** (chapter 7). A nullable return is
  checked here: `@returns {T | null}` at `vanilla-web/store.js:84` and
  `render.js:69`, under `strict` and `checkJs`. A Special Case object would lose
  that check.

The rest are rejected as out of scope.

- **One level of abstraction per function** (chapter 3): it needs a judgement no
  rules file makes for the reader. Partly adopted as "split the parse from the
  read", which asks one yes-or-no question instead.
- **Command-query separation** (chapter 3): a useful default, and too easy to
  apply as a hard rule.
- **Extract a try or catch block into its own function** (chapter 3): it
  multiplies tiny functions in a codebase that has few.
- **Formatting: line width, vertical distance, team rules** (chapter 5): a
  formatter owns these, not an agent.
- **Objects and data structures: the Law of Demeter, hybrids, DTOs**
  (chapter 6).
- **Boundaries, systems, emergence, concurrency** (chapters 8, 11, 12, 13).
- **Do not repeat yourself** (chapter 3): `/simplify` and `code-review` own
  reuse.

## Consequences

- An agent reading the file learns which rules not to apply, because the closing
  statement travels with the rules file it loads.
- The file sits in every session and every subagent, so its cost is paid whether
  or not the session writes code.
- The reasons live here, where a reader who wants them looks for a decision.
- A new rejection edits two places: this list always, and the closing statement
  when an agent is likely to reintroduce the rule.
- The keep-list is illustration, not a registry. Its headline is the general
  predicate, "keep a comment a tool reads", so a new directive in this repo needs
  no line in the rules file. A future maintainer who reads the table as
  exhaustive takes on a per-directive edit the predicate never asked for.
- The 40 long comment blocks are drift, not errors. Each is trimmed when its file
  is next touched, under the `## Scope` rule. Issue #99 tracks them.

## Alternatives considered

- **A mechanical gate half**, a `check-comments.mjs` discovered by
  `vanilla-web/tools/check.mjs`. Rejected because comment *necessity* is a
  judgement, which is the load-bearing reason: measured on this tree, a
  section-marker regex and a commented-out-code regex both hit real code, and a
  journal regex hits test descriptions. `tsc --noEmit` with `noUnusedLocals` and
  `noUnusedParameters` already gates dead imports, locals and parameters. One
  rule is binary rather than judgement, "give a TODO an issue reference", and it
  is the honest candidate if a check is ever wanted: the repo's
  `vanilla-web/tools/js-scan.mjs` already separates a comment from a string
  literal, so the scaffolder at `vanilla-web/previews/new.mjs:60` that emits a
  TODO inside a string is not a false positive for it.
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
