#!/usr/bin/env bash
# Install from a machine that has no clone of this repo, such as a Claude Code
# web session. It fetches only the directories you name (plus the files at the
# repo root), then runs install.sh with the same arguments. Meant for an
# environment's setup script:
#
#   curl -fsSL https://raw.githubusercontent.com/Vortiago/Verktoykasse/main/bootstrap.sh \
#     | bash -s -- clean-code simplified-technical-english
#
# Name what to install. With no names, it fetches the whole tree, and
# install.sh installs every skill and both rules directories.
#
# A setup script runs in a new container, so this expects no checkout at
# VERKTOYKASSE_DIR and stops if one is there. Where a clone lives on, use it
# and install.sh instead.
#
# VERKTOYKASSE_DIR  where the checkout lives  (default ~/.local/share/verktoykasse)
# VERKTOYKASSE_REF  branch, tag or full commit SHA  (default main)
#
# The installed files are symlinks into the checkout, so keep it.
set -euo pipefail

# Everything runs from main(), called on the last line. Under `curl | bash`,
# bash reads the script from stdin as it goes, so a half-read script must not
# start to run, and nothing below may read stdin.
main() {
  local dir=${VERKTOYKASSE_DIR:-$HOME/.local/share/verktoykasse}
  local ref=${VERKTOYKASSE_REF:-main}
  local url=https://github.com/Vortiago/Verktoykasse.git

  # The directory names among the arguments: every word but a flag and the
  # value of --target.
  local names=() arg skip=
  for arg in "$@"; do
    if [[ $skip ]]; then skip=; continue; fi
    case $arg in
      --target) skip=1 ;;
      -*) ;;
      *) names+=("$arg") ;;
    esac
  done

  git init --quiet "$dir"
  git -C "$dir" remote add origin "$url"
  # Cone mode always keeps the files at the root, so install.sh comes along.
  # With no names, the checkout is the whole tree.
  if [[ ${#names[@]} -gt 0 ]]; then
    git -C "$dir" sparse-checkout set --cone "${names[@]}"
  fi

  # Blobless and shallow: the fetch carries one commit and its trees, and the
  # checkout downloads the file contents of the sparse directories only.
  git -C "$dir" fetch --quiet --depth 1 --filter=blob:none origin "$ref"
  git -C "$dir" checkout --quiet FETCH_HEAD
  echo "fetch   $dir @ $(git -C "$dir" rev-parse --short HEAD)"

  # </dev/null keeps an installer that reads stdin off the rest of this script.
  "$dir/install.sh" "$@" </dev/null
}

main "$@"
