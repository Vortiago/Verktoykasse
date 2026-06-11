#!/usr/bin/env bash
# Link the live skill paths to this repo (dotfiles pattern). Idempotent.
# A real directory at a live path is backed up to <path>.pre-verktoykasse
# rather than overwritten.
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

link "$HERE/vanilla-web" "$HOME/.claude/skills/vanilla-web"
