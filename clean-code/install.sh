#!/usr/bin/env bash
# Installer for the clean-code rules. SOURCED by the top-level install.sh, so it
# inherits the `link()` helper and $HERE (the repo root). Not standalone.
# Idempotent. Why this is a rules dir rather than a skill: see is_rules_dir there.
# The rules file carries no `paths:`, so it loads at session start (ADR 0007).

here="$HERE/clean-code"

link "$here/clean-code-rules.md" "$HOME/.claude/rules/clean-code-rules.md"

cat <<'EOF'
note    Clean code is guidance, not enforcement.
        The rules load in every session, in every project.
EOF
