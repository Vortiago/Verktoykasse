# 0007: The writing rules load every session, and clean code governs the file tree

- Status: Accepted
- Date: 2026-09-22
- Deciders: Atle

## Context

`ste-rules.md` and `clean-code-rules.md` each carried `paths:` frontmatter, so
Claude Code loaded each one when a session touched a matching file. Measured
across all 2851 session transcripts since the install on 2026-09-06:

| rules file | loads in a working session | loads in a subagent |
| --- | --- | --- |
| `ste-rules.md` | 0 | 9 |
| `clean-code-rules.md` | 5 | 14 |

The STE rules never reached a working session. All nine subagent loads come from
an agent that read the file on purpose, such as `ste-review`.

The Claude Code binary has four places that arm a path-scoped rule. Three sit
inside the file-read tool, and one handles an `@file` mention. The write tool
and the edit tool arm nothing. Writing a document does not read a document
first, so the STE rules could not fire on the work they govern.

Two further guards compound it. A read loads the file once per context window,
and the file arrives after the call that armed it. Compaction clears the marker,
but the rules return only on the next read.

The wrapper carries no instruction either. It reads `Contents of <path>:` and
nothing more. A rules file without `paths:` loads in the launch-time memory
block instead, under "IMPORTANT: These instructions OVERRIDE any default
behavior and you MUST follow them exactly as written".

The rule text itself works. Commit bodies are in scope for the STE rules, and
they carried 150 em dashes in the 2134 lines before the rules landed, against
zero in the 723 lines since.

Two faults in the clean-code content are separate from delivery. Every
subtractive rule already held across the repo: zero commented-out code, zero
step labels, zero comments restating the next line. What drifted was shape.
`vanilla-web` and `vanilla-components` carry 40 comment blocks of six lines or
more, and the longest runs 42, while `matrix` and `statusline` stay at one or
two lines. The file named six things to delete and one generative rule, and that
rule was the only one with no example. An agent that obeyed the file wrote
nothing, or wrote an essay and passed every rule.

The file also said nothing about how work splits across files and folders, so
files reached hundreds of lines before anybody asked for a split.
`matrix/lib/sessions.ps1` is 623 lines and `matrix/matrix.ps1` is 639.

## Decision

**Neither rules file carries `paths:`.** Both load at session start, in the
memory block, under the override directive. The cost is about 2500 tokens per
session, cached. What `paths:` bought in exchange was zero coverage.

**Each file opens with a directive** naming what it governs, because the
wrapper supplies none. The STE file names four surfaces: a markdown file, a plan
file, a commit or PR body, and Claude's own replies in the terminal. Both files
state that the rules cover text pasted or ported in, not only text composed.

**Clean code leads with a catalogue of what a comment answers**, in five shapes,
each with a real example from this repo. Two rules then set the register. A
comment is prose in the STE register. A comment runs to about four lines, and
reasoning that needs more room belongs in an ADR that the comment cites.

**Clean code gains a `Shape of a file tree` section**, in three rules: a feature
gets a folder holding every part of it, each variant gets its own file behind
one shared interface, and at about 300 lines a file is named to see whether it
holds one thing or two. `vanilla-components/components/` and
`matrix/lib/terminal/` are the exemplars.

**Two rules that contradicted the corpus become keeps.** "Turn a step label into
a named function" fought `render.js:284` and `sessions.ps1:493`, both long
single-job functions whose step comments carry the reason for each step's order.
"Mark a section with a blank line" would have deleted `statusline/lib.sh:6` and
`conventional-commits/validate.sh:40`, which name a contract.

**No hook, and no escape hatch.** A `PreToolUse` check was designed and dropped.
Loading the rules every session is the structural repair, and a further guard
was not wanted. A documented bypass such as `gate-allow:` becomes an agent's
first move rather than its last, so nothing here ships one.

## Corrections to ADR 0004

That record is amended rather than worked around.

- Its claim that "a path-scoped rule reloads only on the next matching read" is
  false. Only a Read arms one at all.
- Its scope statement handed architecture to `code-review` and `/simplify`. The
  file tree now belongs to the rules file. Reuse and design still do not.
- Its Single Responsibility rejection already said "the module is the unit
  here". That aside is now a rule.
- Its function-length rejection stands, and now states the boundary: a function
  has no length rule, a file gets a check at about 300 lines.
- Its rejection of "one level of abstraction per function" is now partial.
  "Split the parse from the read" asks one yes-or-no question.
- Its rejection of a `clean-code-review` subagent gave a reason that does not
  hold. Neither existing reviewer asks this file's questions.

## Consequences

- Both files sit in every session and every subagent, so the token cost is paid
  whether or not the session writes anything.
- `/code-review` can cite the rules, because it reads the memory block that a
  path-scoped rule never entered.
- The STE rules now govern Claude's replies, which no file-scoped mechanism
  could reach.
- The 40 long comment blocks and the 14 legacy prose files are drift, not
  errors. Each is fixed when its file is next touched, under the `## Scope`
  rule.
- A future delivery change edits two places: the frontmatter and this record.

## Alternatives considered

- **A `SessionStart` hook that re-seeds after each compaction.** Rejected: it
  does fire on `compact`, but an unscoped rules file is re-sent after every
  compaction already, with better framing and no machinery.
- **A `PreToolUse` block plus a `PostToolUse` advisory check.** Rejected: more
  layers of guard than wanted, and every workable design needed an escape hatch.
  Reconsider only if the measurements below do not move.
- **`~/.claude/CLAUDE.md` carries the rules.** Rejected: once `paths:` is gone
  the rules load in the same block, above `CLAUDE.md`.
- **A `UserPromptSubmit` injection.** Rejected: 2500 tokens per prompt, and it
  buys nothing over loading once per session.
- **An output style.** Rejected: it would carry the register into Claude's
  replies, which the scope sentence already does. It also replaces the built-in
  coding instructions and does not reach subagents.
- **Making either file a skill.** Rejected: a skill loads on the model's
  judgement of a description and gets no imperative wrapper. A skill carries a
  workflow, not standing policy.
- **Widening the STE `paths:` to code files.** Rejected: it would load 5.6KB of
  document-shape and procedure rules on every code edit. The comment-prose rules
  live in clean code instead, so one file loads per file type, and
  `ste-review.md` needs no change.

## Measurements

These are the numbers this decision is judged on.

- `ste-rules.md` loaded into zero working sessions. It should now load once per
  session, and `/context` should list both files under Memory files.
- Markdown writes carried 17.85 em dashes and 1.07 contractions per 1000 words,
  with 86% of writes holding at least one hard violation.
- Written code carried 2.51 section banners per 1000 lines, and 0.96 per 1000
  when the rules happened to be loaded.
