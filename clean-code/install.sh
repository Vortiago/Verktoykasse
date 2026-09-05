#!/usr/bin/env bash
# Installer for the clean-code rules. SOURCED by the top-level install.sh, so it
# inherits the `link()` helper and $HERE (the repo root). Not standalone.
# Idempotent. Why this is a rules dir rather than a skill: see is_rules_dir there.

here="$HERE/clean-code"

link "$here/clean-code-rules.md" "$HOME/.claude/rules/clean-code-rules.md"

cat <<'EOF'
note    Clean code is guidance, not enforcement.
        The rules load when Claude touches a code file.
EOF
