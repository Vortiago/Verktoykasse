#!/usr/bin/env bash
# Per-skill installer for `vanilla-components`. SOURCED by the top-level install.sh,
# so it inherits the `link()` helper and $HERE (the repo root). Not standalone.
# Idempotent.

skill="$HERE/vanilla-components"
live="$HOME/.claude/skills/vanilla-components"

# 1. skill doc + parts (one symlinked dir)
link "$skill" "$live"

# 2. repo-local pre-commit hook: keep the vendored toolkit in sync with vanilla-web
#    (see docs/adr/0001-vendored-toolkit-not-symlink.md). Registered LOCAL — not global
#    like conventional-commits — because the vendored relationship exists only in this
#    repo. `--local` writes the shared common config, so one registration covers every
#    worktree, present and future (extensions.worktreeConfig is unset).
#    The hook command runs through the $live symlink (→ the worktree this installed
#    from), so run install from a STABLE worktree (main): a feature worktree that's
#    later removed would dangle the symlink and break commits repo-wide.
ver=$(git --version | awk '{print $3}')
need=2.54.0
if [[ "$(printf '%s\n%s\n' "$need" "$ver" | sort -V | head -n1)" != "$need" ]]; then
  echo "warn    git $ver < $need — config-based pre-commit hook will NOT fire (toolkit drift unguarded)" >&2
else
  cmd="$live/sync-from-web.sh --precommit"
  if [[ "$(git -C "$HERE" config --local --get hook.sync-from-web.command 2>/dev/null)" == "$cmd" ]]; then
    echo "ok      git hook.sync-from-web already registered (local pre-commit)"
  else
    git -C "$HERE" config --local hook.sync-from-web.event   pre-commit
    git -C "$HERE" config --local hook.sync-from-web.command "$cmd"
    echo "linked  git hook.sync-from-web -> pre-commit ($cmd)"
  fi
fi
