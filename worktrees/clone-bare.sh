#!/usr/bin/env bash
# Clone a repo into the bare+worktree layout used under $REPOS_ROOT:
#   <repo>/.git  (bare)  +  <repo>/main  (worktree)
# Usage: ./clone-bare.sh <repo>
# <repo> is anything `gh repo clone` accepts: name (your own repo), owner/name, or URL
set -euo pipefail

REPOS_ROOT="${REPOS_ROOT:-$HOME/repos}"

repo="$1"
name="${repo##*/}"; name="${name%.git}"
base="$REPOS_ROOT/$name"

[ -e "$base" ] && { echo "error: $base already exists" >&2; exit 1; }

gh repo clone "$repo" "$base/.git" -- --quiet --bare
git -C "$base" config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
git -C "$base" config push.autoSetupRemote true
git -C "$base" fetch --quiet --prune origin
git -C "$base" remote set-head origin -a

# clone --bare mirrors every remote branch as a local branch; keep only the default
default=$(git -C "$base" symbolic-ref --short HEAD)   # e.g. main
git -C "$base" for-each-ref refs/heads --format='%(refname:short)' \
  | { grep -vx "$default" || true; } \
  | xargs -r -I{} git -C "$base" branch -D {}
git -C "$base" branch --set-upstream-to="origin/$default" "$default"

git -C "$base" worktree add --quiet "$base/$default" "$default"
git -C "$base" worktree list
