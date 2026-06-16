#!/usr/bin/env bash
# Per-tool installer for `statusline`. SOURCED by the top-level install.sh for
# the claude target, so it inherits the link() helper and $HERE (the repo root).
# Not meant to run standalone. Idempotent.

tool="$HERE/statusline"

# 1. skill doc — invocable as /expand-statusline (folder name ≠ skill name)
link "$tool" "$HOME/.claude/skills/expand-statusline"

# 2. the core script — the path settings.json runs
link "$tool/statusline.sh" "$HOME/.claude/statusline.sh"

# Projects extend the line themselves: a committed .claude/statusline-ext.sh in
# the repo, or a personal ~/.config/claude-statusline/projects/<project>.sh — see
# the expand-statusline skill. Nothing project-specific is wired here.

# 3. register the status line in settings.json, only if not already ours
settings="$HOME/.claude/settings.json"
if [[ -f "$settings" ]] && grep -q '"statusLine"' "$settings" && grep -qF 'statusline.sh' "$settings"; then
  echo "ok      statusLine already registered in settings.json"
else
  python3 - "$settings" 'bash "$HOME/.claude/statusline.sh"' <<'PY'
import json, os, shutil, sys
settings, cmd = sys.argv[1], sys.argv[2]
data = {}
if os.path.exists(settings):
    shutil.copy2(settings, settings + ".pre-verktoykasse")
    with open(settings) as f:
        data = json.load(f)
data["statusLine"] = {"type": "command", "command": cmd}
os.makedirs(os.path.dirname(settings), exist_ok=True)
with open(settings, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print("linked  statusLine -> ~/.claude/statusline.sh in settings.json")
PY
fi
