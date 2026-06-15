#!/usr/bin/env bash
# Create a worktree in the bare+sibling layout under $REPOS_ROOT.
# Usage: new-worktree.sh <repo> <branch-name>
#   new-worktree.sh myrepo feature-x   → $REPOS_ROOT/myrepo/feature-x on branch feature-x
#   new-worktree.sh myrepo '#123'      → $REPOS_ROOT/myrepo/pr-123 from PR #123's head
# Prints the worktree path on success.
# Delegates to the Claude Code WorktreeCreate hook so all creation paths share
# one implementation (fetch, base ref, existing-branch reuse, .worktreeinclude).
set -euo pipefail

REPOS_ROOT="${REPOS_ROOT:-$HOME/repos}"
HOOK="${WORKTREE_CREATE_HOOK:-$HOME/.claude/hooks/worktree-create.sh}"

repo="$1"
name="$2"
src="$REPOS_ROOT/$repo/main"
[[ -d "$src" ]] || src="$REPOS_ROOT/$repo"

jq -cn --arg name "$name" --arg cwd "$src" '{name: $name, cwd: $cwd}' \
  | "$HOOK"
