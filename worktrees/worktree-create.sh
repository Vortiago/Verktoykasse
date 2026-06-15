#!/usr/bin/env bash
# WorktreeCreate hook for Claude Code.
#
# Canonical copy: lives in the Verktøykasse `worktrees` skill and is symlinked
# to ~/.claude/hooks/worktree-create.sh by worktrees/install.sh. Edit it here.
#
# In repos using the bare+sibling layout ($REPOS_ROOT/<repo>/.git is a BARE
# clone, working trees are siblings like <repo>/main), worktrees are created as
# <repo>/<name> on branch <name>.
# In ordinary repos it replicates Claude Code's default scheme:
# <repo-root>/.claude/worktrees/<name> on branch worktree-<name>.
#
# Contract (https://code.claude.com/docs/en/hooks#worktreecreate):
#   stdin:  JSON with .name (worktree slug) and .cwd
#   stdout: absolute path of the created worktree (ONLY the path)
#   exit non-zero: abort worktree creation
# Everything except the final path must go to stderr.
set -euo pipefail

input=$(cat)
name=$(jq -r '.name' <<<"$input")
cwd=$(jq -r '.cwd' <<<"$input")

[[ -n "$name" && "$name" != "null" ]] || { echo "WorktreeCreate: empty name" >&2; exit 1; }

common=$(git -C "$cwd" rev-parse --path-format=absolute --git-common-dir)
G=(git --git-dir="$common")

# "#1234" → PR worktree: fetch the PR head and base the worktree on it
prbase=""
if [[ "$name" =~ ^#([0-9]+)$ ]]; then
  pr="${BASH_REMATCH[1]}"
  name="pr-$pr"
  "${G[@]}" fetch --quiet origin "refs/pull/$pr/head" >&2
  prbase=$("${G[@]}" rev-parse FETCH_HEAD)
fi
name=${name//\//-}   # keep worktree dirs flat

# Layout detection: bare repo whose git dir is literally <base>/.git → sibling scheme
if [[ "$("${G[@]}" config --bool core.bare 2>/dev/null || echo false)" == true \
      && "$(basename "$common")" == .git ]]; then
  wt="$(dirname "$common")/$name"
  branch="$name"
elif [[ "$(basename "$common")" == .git ]]; then
  wt="$(dirname "$common")/.claude/worktrees/$name"
  branch="worktree-$name"
else
  wt="$(git -C "$cwd" rev-parse --show-toplevel)/.claude/worktrees/$name"
  branch="worktree-$name"
fi

# Reuse an already-registered worktree at that path; refuse unrelated dirs
if [[ -e "$wt" ]]; then
  if "${G[@]}" worktree list --porcelain | grep -qxF "worktree $wt"; then
    echo "$wt"
    exit 0
  fi
  echo "WorktreeCreate: $wt exists but is not a registered worktree" >&2
  exit 1
fi

# Base ref like the default behavior: fresh from origin/HEAD, else local HEAD
if [[ -n "$prbase" ]]; then
  baseref=$prbase
else
  "${G[@]}" fetch --quiet origin >/dev/null 2>&1 || true
  baseref=$("${G[@]}" rev-parse --verify --quiet origin/HEAD || true)
  [[ -n "$baseref" ]] || baseref=$(git -C "$cwd" rev-parse HEAD)
fi

if "${G[@]}" show-ref --verify --quiet "refs/heads/$branch"; then
  "${G[@]}" worktree add "$wt" "$branch" >&2
else
  "${G[@]}" worktree add -b "$branch" "$wt" "$baseref" >&2
fi

# A WorktreeCreate hook replaces ALL default logic, so .worktreeinclude is not
# processed by Claude Code — copy matching gitignored files from the source
# working tree ourselves (intersection of gitignored ∩ .worktreeinclude).
src=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || true)
if [[ -n "$src" && -f "$src/.worktreeinclude" ]]; then
  (
    cd "$src"
    comm -z -12 \
      <(git ls-files -z --others --ignored --exclude-standard | sort -z) \
      <(git ls-files -z --others --ignored --exclude-from=.worktreeinclude | sort -z) |
      while IFS= read -r -d '' f; do
        mkdir -p "$wt/$(dirname "$f")"
        cp -a "$f" "$wt/$f"
        echo "worktreeinclude: copied $f" >&2
      done
  ) >&2
fi

echo "$wt"
