#!/usr/bin/env bash
# Per-skill installer for `worktrees`. SOURCED by the top-level install.sh, so
# it inherits the `link()` helper and $HERE (the repo root). Not meant to run
# standalone. Idempotent.

skill="$HERE/worktrees"

# 1. skill doc + 2. the hook scripts (paths settings.json references)
link "$skill" "$HOME/.claude/skills/worktrees"
link "$skill/worktree-create.sh"      "$HOME/.claude/hooks/worktree-create.sh"
link "$skill/guard-default-branch.sh" "$HOME/.claude/hooks/guard-default-branch.sh"

# 3. repos root: env wins; else prompt with the folder above this repo as default
if [[ -z "${REPOS_ROOT:-}" ]]; then
  default_root=$(dirname "$(dirname "$(git -C "$HERE" rev-parse --show-toplevel)")")
  if [[ -t 0 ]]; then
    read -r -p "worktrees: repos root for the bare+sibling layout [$default_root]: " REPOS_ROOT
    REPOS_ROOT="${REPOS_ROOT:-$default_root}"
  else
    REPOS_ROOT="$default_root"
    echo "worktrees: REPOS_ROOT=$REPOS_ROOT (non-interactive default)"
  fi
fi
mkdir -p "$REPOS_ROOT"

# 4. helper scripts as dotfiles in the repos root
link "$skill/new-worktree.sh" "$REPOS_ROOT/.new-worktree.sh"
link "$skill/clone-bare.sh"   "$REPOS_ROOT/.clone-bare.sh"

# 5 + 6. register both hooks in settings.json (idempotent).
#
# The command is a single-quoted LITERAL: bash must not expand $HOME here. A bare
# `.sh` path needs an interpreter on Windows, and `bash "..."` works everywhere, so
# let the hook's own shell expand $HOME when it runs. Expanding it here would also
# write the non-ASCII in a user's name into settings.json, which python re-reads in
# the locale codec (cp1252 on Windows) and corrupts a layer deeper per run.
settings="$HOME/.claude/settings.json"

register_hook() { # $1 = event, $2 = script basename, $3 = command, $4 = matcher ('' for none)
  python3 - "$settings" "$1" "$2" "$3" "$4" <<'PY'
import json, os, shutil, sys

settings, event, marker, cmd, matcher = sys.argv[1:6]

data = {}
if os.path.exists(settings):
    # Don't clobber an earlier (more pristine) backup: a prior step or run may
    # already have snapshotted the original.
    backup = settings + ".pre-verktoykasse"
    if not os.path.exists(backup):
        shutil.copy2(settings, backup)
    with open(settings, encoding="utf-8") as f:
        data = json.load(f)

entries = data.setdefault("hooks", {}).setdefault(event, [])

# Match on the script BASENAME, not the whole command. Only the $HOME segment
# ever got rewritten or mangled, so the basename is the one part every historical
# spelling shares. That makes an old entry findable, and therefore fixable in
# place rather than joined by another duplicate.
changed = seen = False
for entry in entries:
    kept = []
    for h in entry.get("hooks", []):
        if marker not in (h.get("command") or ""):
            kept.append(h)          # somebody else's hook, leave it alone
        elif not seen:              # first of ours wins, corrected if need be
            seen = True
            if h.get("command") != cmd:
                h["command"] = cmd
                changed = True
            kept.append(h)
        else:
            changed = True          # a duplicate from an earlier run, drop it
    entry["hooks"] = kept
entries[:] = [e for e in entries if e.get("hooks")]

if not seen:
    entry = {"hooks": [{"type": "command", "command": cmd}]}
    if matcher:
        entry["matcher"] = matcher
    entries.append(entry)
    changed = True

if changed:
    os.makedirs(os.path.dirname(settings), exist_ok=True)
    with open(settings, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"linked  {event} -> {marker} in settings.json")
else:
    print(f"ok      {event} -> {marker} already registered")
PY
}

register_hook WorktreeCreate worktree-create.sh \
  'bash "$HOME/.claude/hooks/worktree-create.sh"' ''

# One matcher covers the file-edit tools + Bash; the guard itself dispatches and
# fails open outside the bare+sibling layout.
register_hook PreToolUse guard-default-branch.sh \
  'bash "$HOME/.claude/hooks/guard-default-branch.sh"' \
  'Edit|Write|MultiEdit|NotebookEdit|Bash'
