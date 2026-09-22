# 0007: The rules files load every session

- Status: Accepted
- Date: 2026-09-22
- Deciders: Atle

Covers both rules files, so it sits apart from ADR 0003 and ADR 0004, which each
govern one file's content.

## Context

Both files carried `paths:` frontmatter. Measured across all 2851 session
transcripts since the install on 2026-09-06, `ste-rules.md` loaded into zero
working sessions and `clean-code-rules.md` into five.

Only a Read arms a path-scoped rule. The write tool and the edit tool arm
nothing, so writing prose never loaded the prose rules. The scoped form also
arrives after the call that armed it, at most once per context window, wrapped
in a bare `Contents of <path>:` with no directive. A file without `paths:` loads
in the launch-time memory block instead, under "IMPORTANT: These instructions
OVERRIDE any default behavior and you MUST follow them exactly as written".

## Decision

Neither file carries `paths:`. Both load at session start, and each opens with
its own directive naming what it governs, because the wrapper supplies none.

The cost is about 3000 tokens per session and per subagent spawn, cached. What
`paths:` bought in exchange was zero coverage.

## Consequences

- Both files sit in every session, so the cost is paid whether or not the
  session writes anything.
- `/code-review` can cite the rules, because it reads the memory block that a
  path-scoped rule never entered.
- The STE rules reach Claude's replies, which no file-scoped mechanism could.
- ADR 0004's claim that a path-scoped rule "reloads only on the next matching
  read" is corrected there.

## Alternatives considered

- **A `SessionStart` hook re-seeding after each compaction.** Rejected: an
  unscoped file is re-sent after every compaction already, with no machinery.
- **A `PreToolUse` check on the mechanical rules.** Rejected: more layers of
  guard than wanted, and every workable design needed an escape hatch. A
  documented bypass becomes an agent's first move rather than its last.
- **`~/.claude/CLAUDE.md` carries the rules.** Rejected: they now load in the
  same block, above `CLAUDE.md`.
- **An output style.** Rejected: the STE scope sentence already reaches Claude's
  replies. A style also replaces the built-in coding instructions and does not
  reach subagents.
- **Widening the STE `paths:` to code files.** Rejected: it would load the
  document-shape and procedure rules on every code edit. The comment-prose rule
  lives in `clean-code-rules.md` instead.
