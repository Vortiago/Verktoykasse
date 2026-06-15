#!/usr/bin/env bash
# Per-skill installer for `worktrees`. SOURCED by the top-level install.sh, so
# it inherits the `link()` helper and $HERE (the repo root). Not meant to run
# standalone. Idempotent.

skill="$HERE/worktrees"

# 1. skill doc + 2. the WorktreeCreate hook (path settings.json references)
link "$skill" "$HOME/.claude/skills/worktrees"
link "$skill/worktree-create.sh" "$HOME/.claude/hooks/worktree-create.sh"

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

# 5. register the WorktreeCreate hook, only if not already pointing at our path
hook="$HOME/.claude/hooks/worktree-create.sh"
settings="$HOME/.claude/settings.json"
if [[ -f "$settings" ]] && grep -q '"WorktreeCreate"' "$settings" \
   && grep -qF "$hook" "$settings"; then
  echo "ok      WorktreeCreate already registered in settings.json"
else
  python3 - "$settings" "$hook" <<'PY'
import json, os, shutil, sys
settings, hook = sys.argv[1], sys.argv[2]
data = {}
if os.path.exists(settings):
    shutil.copy2(settings, settings + ".pre-verktoykasse")
    with open(settings) as f:
        data = json.load(f)
hooks = data.setdefault("hooks", {})
entries = hooks.setdefault("WorktreeCreate", [])
have = any(
    h.get("command") == hook
    for entry in entries
    for h in entry.get("hooks", [])
)
if not have:
    entries.append({"hooks": [{"type": "command", "command": hook}]})
    os.makedirs(os.path.dirname(settings), exist_ok=True)
    with open(settings, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"linked  WorktreeCreate -> {hook} in settings.json")
else:
    print("ok      WorktreeCreate already registered in settings.json")
PY
fi
