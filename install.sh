#!/usr/bin/env bash
# Link the live skill paths to this repo (dotfiles pattern). Idempotent.
# A real directory at a live path is backed up to <path>.pre-verktoykasse
# rather than overwritten.
#
# The CALLER decides target + skills; this installer holds NO skill->CLI policy,
# only where each CLI keeps its skills (TARGET_DIR).
#
# Usage:
#   ./install.sh [skill...]                     install (all, or the named) for Claude
#   ./install.sh --target opencode [skill...]   install for OpenCode (plain symlink, no hooks)
#
# Targets: claude (default) | opencode.
# A skill's own <skill>/install.sh (hooks / extra setup) is Claude-specific, so it is
# sourced ONLY for the claude target; every other target gets a plain symlink of the dir.
set -euo pipefail

HERE=$(dirname "$(readlink -f "$0")")

declare -A TARGET_DIR=(
  [claude]="$HOME/.claude/skills"
  [opencode]="$HOME/.config/opencode/skills"
)
TARGET=claude

link() { # $1 = repo dir, $2 = live path
  local target=$1 live=$2
  if [[ -L $live ]]; then
    [[ $(readlink -f "$live") == "$target" ]] && { echo "ok      $live"; return; }
    rm "$live"
  elif [[ -e $live ]]; then
    mv "$live" "$live.pre-verktoykasse"
    echo "backup  $live -> $live.pre-verktoykasse"
  fi
  mkdir -p "$(dirname "$live")"
  ln -s "$target" "$live"
  echo "linked  $live -> $target"
}

install_skill() { # $1 = skill name — installed for the current $TARGET
  # NOTE: skills are keyed by DIRECTORY name here; a skill's invocation name comes
  # from its SKILL.md `name:` frontmatter and may differ — e.g. the `statusline/`
  # dir is invoked as `/expand-statusline`.
  local name=$1
  [[ -d "$HERE/$name" ]] || { echo "error: no skill '$name' in $HERE" >&2; return 1; }
  if [[ $TARGET == claude && -f "$HERE/$name/install.sh" ]]; then
    # Claude-specific hooks / extra setup — only for the claude target.
    # shellcheck source=/dev/null
    source "$HERE/$name/install.sh"
  else
    link "$HERE/$name" "${TARGET_DIR[$TARGET]}/$name"
  fi
}

skills=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --target) TARGET=${2:?--target needs a value}; shift 2 ;;
    --target=*) TARGET=${1#*=}; shift ;;
    *) skills+=("$1"); shift ;;
  esac
done
[[ -n ${TARGET_DIR[$TARGET]:-} ]] || {
  echo "error: unknown target '$TARGET' (have: ${!TARGET_DIR[*]})" >&2; exit 1; }

if [[ ${#skills[@]} -eq 0 ]]; then
  for d in "$HERE"/*/; do
    skills+=("$(basename "$d")")
  done
fi

echo "target: $TARGET -> ${TARGET_DIR[$TARGET]}"
for s in "${skills[@]}"; do
  install_skill "$s"
done
