#!/usr/bin/env bash
# Install from a machine that has no clone of this repo, such as a Claude Code
# web session. It clones the repo (or updates the clone it made before), then
# runs install.sh with the same arguments. Meant for an environment's setup
# script:
#
#   curl -fsSL https://raw.githubusercontent.com/Vortiago/Verktoykasse/main/bootstrap.sh \
#     | bash -s -- clean-code simplified-technical-english
#
# Name what to install. With no names, install.sh installs every skill and
# both rules directories.
#
# VERKTOYKASSE_DIR  where the clone lives  (default ~/.local/share/verktoykasse)
# VERKTOYKASSE_REF  branch, tag or full commit SHA  (default main)
#
# The installed files are symlinks into the clone, so keep the clone.
set -euo pipefail

# Everything runs from main(), called on the last line. Under `curl | bash`,
# bash reads the script from stdin as it goes, so a half-read script must not
# start to run, and nothing below may read stdin.
main() {
  local dir=${VERKTOYKASSE_DIR:-$HOME/.local/share/verktoykasse}
  local ref=${VERKTOYKASSE_REF:-main}
  local url=https://github.com/Vortiago/Verktoykasse.git

  if [[ -d $dir/.git ]]; then
    git -C "$dir" fetch --quiet --depth 1 origin "$ref"
    git -C "$dir" checkout --quiet --force FETCH_HEAD
  else
    mkdir -p "$(dirname "$dir")"
    git clone --quiet --depth 1 "$url" "$dir"
    if [[ $ref != main ]]; then
      git -C "$dir" fetch --quiet --depth 1 origin "$ref"
      git -C "$dir" checkout --quiet FETCH_HEAD
    fi
  fi
  echo "clone   $dir @ $(git -C "$dir" rev-parse --short HEAD)"

  # </dev/null: a skill installer that prompts takes its non-interactive default.
  "$dir/install.sh" "$@" </dev/null
}

main "$@"
