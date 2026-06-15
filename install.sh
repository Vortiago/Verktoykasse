#!/usr/bin/env bash
# Link the live skill paths to this repo (dotfiles pattern). Idempotent.
# A real directory at a live path is backed up to <path>.pre-verktoykasse
# rather than overwritten.
#
# Usage:
#   ./install.sh                 install every skill
#   ./install.sh worktrees ...   install only the named skill(s)
#
# A skill with its own <skill>/install.sh is sourced (it may symlink extra
# files, register hooks, etc.); otherwise the skill dir is linked into
# ~/.claude/skills/<skill>.
set -euo pipefail

HERE=$(dirname "$(readlink -f "$0")")

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

install_skill() { # $1 = skill name
  local name=$1
  [[ -d "$HERE/$name" ]] || { echo "error: no skill '$name' in $HERE" >&2; return 1; }
  if [[ -f "$HERE/$name/install.sh" ]]; then
    # shellcheck source=/dev/null
    source "$HERE/$name/install.sh"
  else
    link "$HERE/$name" "$HOME/.claude/skills/$name"
  fi
}

skills=("$@")
if [[ ${#skills[@]} -eq 0 ]]; then
  for d in "$HERE"/*/; do
    skills+=("$(basename "$d")")
  done
fi

for s in "${skills[@]}"; do
  install_skill "$s"
done
