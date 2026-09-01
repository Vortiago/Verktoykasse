#!/usr/bin/env bash
# Installer for the Simplified Technical English rules. SOURCED by the top-level
# install.sh, so it inherits the `link()` helper and $HERE (the repo root).
# Not meant to run standalone. Idempotent.
#
# This is NOT a skill: there is no SKILL.md and nothing is model-invocable. It is
# two files, each symlinked to where Claude Code already looks for its kind:
#
#   ste-rules.md   -> ~/.claude/rules/     loads on any *.md edit, in every project
#   ste-review.md  -> ~/.claude/agents/    the reviewer, invoked by name
#
# One rules file, one consumer, no copies. `ste-review` reads it at run time, and
# nothing else in this repo points at it. The rules themselves cover a commit
# message body and a PR body, which `conventional-commits` owns the grammar of.

here="$HERE/simplified-technical-english"

# 1. the rules, as a path-scoped rule. The `paths:` frontmatter in the file is
#    what makes it load when Claude reads or edits a markdown file, rather than
#    sitting in context all session.
link "$here/ste-rules.md" "$HOME/.claude/rules/ste-rules.md"

# 2. the reviewer subagent. link() already does `mkdir -p` on the parent, so it
#    creates ~/.claude/agents/ on a machine that has never had one.
link "$here/ste-review.md" "$HOME/.claude/agents/ste-review.md"

cat <<'EOF'
note    Simplified Technical English is guidance, not enforcement.
        The rules load automatically when Claude touches a *.md file.
        To review on demand:  @ste-review  (or name it in a prompt)
EOF
