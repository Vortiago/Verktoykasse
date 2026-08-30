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
#
# A single-quoted LITERAL: bash must not expand $HOME here. A bare `.sh` path is
# executable on macOS and Linux but not on Windows, and an expanded $HOME under
# Git Bash also drags the user's possibly non-ASCII name into a file python then
# re-reads in the locale codec, mangling it a little more on every run. `bash
# "..."` is correct on all three, and stays pure ASCII.
settings="$HOME/.claude/settings.json"
python3 - "$settings" 'bash "$HOME/.claude/skills/conventional-commits/pr-title-check.sh"' <<'PY'
import json, os, shutil, sys

settings, cmd = sys.argv[1], sys.argv[2]
marker = "pr-title-check.sh"

data = {}
if os.path.exists(settings):
    backup = settings + ".pre-verktoykasse"
    if not os.path.exists(backup):
        shutil.copy2(settings, backup)
    with open(settings, encoding="utf-8") as f:
        data = json.load(f)

entries = data.setdefault("hooks", {}).setdefault("PreToolUse", [])

# Match on the script basename: only the $HOME segment ever got rewritten or
# mangled, so that is the part every historical spelling still shares. An old
# entry is therefore found and corrected rather than duplicated.
changed = seen = False
for entry in entries:
    kept = []
    for h in entry.get("hooks", []):
        if marker not in (h.get("command") or ""):
            kept.append(h)
        elif not seen:
            seen = True
            if h.get("command") != cmd:
                h["command"] = cmd
                changed = True
            kept.append(h)
        else:
            changed = True
    entry["hooks"] = kept
entries[:] = [e for e in entries if e.get("hooks")]

if not seen:
    entries.append({"matcher": "Bash", "hooks": [{"type": "command", "command": cmd}]})
    changed = True

if changed:
    os.makedirs(os.path.dirname(settings), exist_ok=True)
    with open(settings, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print("linked  PreToolUse(Bash) -> pr-title-check.sh in settings.json")
else:
    print("ok      PreToolUse(Bash) conventional-commits already registered")
PY
