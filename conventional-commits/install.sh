#!/usr/bin/env bash
# Per-skill installer for `conventional-commits`. SOURCED by the top-level
# install.sh, so it inherits the `link()` helper and $HERE (the repo root).
# Not meant to run standalone. Idempotent.
#
# Both hooks reference the LIVE skill path (not a ~/.claude/hooks symlink like
# worktrees): the wrappers `source ./validate.sh`, so the scripts must stay
# co-located, and the symlinked skill dir already gives them a stable home.

skill="$HERE/conventional-commits"
live="$HOME/.claude/skills/conventional-commits"

# 1. skill doc + scripts (one symlinked dir)
link "$skill" "$live"

# 2. git >= 2.54 is required for config-based hooks
ver=$(git --version | awk '{print $3}')
need=2.54.0
if [[ "$(printf '%s\n%s\n' "$need" "$ver" | sort -V | head -n1)" != "$need" ]]; then
  echo "warn    git $ver < $need — the config-based commit-msg hook will NOT fire" >&2
fi

# 3. global git commit-msg hook (config-based)
cmd="$live/commit-msg.sh"
if [[ "$(git config --global --get hook.conventional-commits.command)" == "$cmd" ]]; then
  echo "ok      git hook.conventional-commits already registered"
else
  git config --global hook.conventional-commits.event   commit-msg
  git config --global hook.conventional-commits.command "$cmd"
  echo "linked  git hook.conventional-commits -> commit-msg ($cmd)"
fi

# 4. Claude PreToolUse(Bash) hook -> pr-title-check.sh, in settings.json
hook="$live/pr-title-check.sh"
settings="$HOME/.claude/settings.json"
python3 - "$settings" "$hook" <<'PY'
import json, os, shutil, sys
settings, hook = sys.argv[1], sys.argv[2]
data = {}
if os.path.exists(settings):
    with open(settings) as f:
        data = json.load(f)
hooks = data.setdefault("hooks", {})
entries = hooks.setdefault("PreToolUse", [])
have = any(
    h.get("command") == hook
    for entry in entries
    for h in entry.get("hooks", [])
)
if have:
    print("ok      PreToolUse(Bash) conventional-commits already registered")
else:
    if os.path.exists(settings):
        shutil.copy2(settings, settings + ".pre-verktoykasse")
    entries.append({"matcher": "Bash", "hooks": [{"type": "command", "command": hook}]})
    os.makedirs(os.path.dirname(settings), exist_ok=True)
    with open(settings, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"linked  PreToolUse(Bash) -> {hook} in settings.json")
PY
