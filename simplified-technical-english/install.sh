#!/usr/bin/env bash
# Installer for the Simplified Technical English rules. SOURCED by the top-level
# install.sh, so it inherits the `link()` helper and $HERE (the repo root).
# Not meant to run standalone. Idempotent.
#
# This is NOT a skill: there is no SKILL.md, so no slash command reaches either
# file. It is two files, each symlinked to where Claude Code already looks for
# its kind:
#
#   ste-rules.md   -> ~/.claude/rules/     loads every session, every project
#   ste-review.md  -> ~/.claude/agents/    the reviewer, by `@` or by delegation
#
# Not a skill does not mean user-only. Claude delegates to `ste-review` on its
# `description`, and no frontmatter field turns that off. To stop it, deny
# `Agent(ste-review)` in settings.
#
# One rules file, one consumer, no copies. `ste-review` reads it at run time, and
# nothing else in this repo points at it. The rules themselves cover a commit
# message body and a PR body, which `conventional-commits` owns the grammar of.

here="$HERE/simplified-technical-english"

# 1. the rules. The file carries no `paths:` frontmatter, so it loads at session
#    start. Only a Read arms a path-scoped rule, and writing prose does not read
#    prose first, so the scoped form never reached a working session (ADR 0007).
link "$here/ste-rules.md" "$HOME/.claude/rules/ste-rules.md"

# 2. the reviewer subagent. link() already does `mkdir -p` on the parent, so it
#    creates ~/.claude/agents/ on a machine that has never had one.
link "$here/ste-review.md" "$HOME/.claude/agents/ste-review.md"

cat <<'EOF'
note    Simplified Technical English is guidance, not enforcement.
        The rules load in every session, and cover a markdown file, a plan
        file, a commit or PR body, and Claude's own replies.
        To review on demand:  @ste-review  (or name it in a prompt)
EOF
