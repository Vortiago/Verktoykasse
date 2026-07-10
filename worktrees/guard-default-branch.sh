#!/usr/bin/env bash
# PreToolUse guard for Claude Code — refuse direct edits/commits on the DEFAULT
# branch of a bare+sibling repo (the `<repo>/main` worktree). main should only
# advance via merge/pull; author changes on a feature worktree instead.
#
# Canonical copy lives in the Verktøykasse `worktrees` skill and is symlinked to
# ~/.claude/hooks/guard-default-branch.sh by worktrees/install.sh. Edit it here.
#
# Matches:
#   Edit | Write | MultiEdit | NotebookEdit  → checks tool_input.file_path
#   Bash, only `git commit` / `git add …`    → checks the session cwd
#
# Contract (https://code.claude.com/docs/en/hooks#pretooluse):
#   stdin JSON {tool_name, tool_input{file_path|command}, cwd}
#   exit 2 + stderr → block the call (Claude sees the reason); exit 0 → allow.
# Fails OPEN: anything it cannot positively confirm as "on the default branch of
# a bare+sibling repo" is allowed, so it never blocks an edit it cannot reason
# about (non-git dirs, detached HEAD, ordinary repos, the bare root, seed tree…).
set -u

# User-only opt-out: env is inherited from Claude's launch, and Bash-tool env
# does not persist across calls — so Claude cannot flip this mid-session.
[[ -n "${WORKTREES_ALLOW_MAIN_EDITS:-}" ]] && exit 0

input=$(cat)
# tool_name + cwd in one parse (neither is ever multi-line); the payload field
# (file_path / command) is extracted per-branch below, where it may be.
IFS=$'\t' read -r tool cwd <<<"$(jq -r '[.tool_name, .cwd] | @tsv' <<<"$input")"
[[ -n "$cwd" ]] || cwd=$PWD

# Resolve the target directory + the verb used in the block message.
case "$tool" in
  Edit|Write|MultiEdit|NotebookEdit)
    verb=edit
    path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' <<<"$input")
    [[ -n "$path" ]] || exit 0
    # Absolute paths are used as-is; relative ones resolve against cwd. Windows
    # drive-letter paths (C:\… or C:/…) are absolute too but don't start with /.
    case "$path" in /*|[A-Za-z]:[/\\]*) ;; *) path="$cwd/$path" ;; esac
    path=${path//\\//}   # normalize Windows backslashes so dirname/git see one separator
    dir=$(dirname "$path")
    # New file in a not-yet-created dir: walk up to the nearest existing ancestor.
    while [[ "$dir" != / && ! -d "$dir" ]]; do dir=$(dirname "$dir"); done
    ;;
  Bash)
    verb=commit
    cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
    # Only authoring commands — pull/merge/fetch/rebase advance main legitimately
    # and contain neither verb, so they fall through to exit 0.
    case "$cmd" in *"git commit"*|*"git add "*) dir=$cwd ;; *) exit 0 ;; esac
    ;;
  *) exit 0 ;;
esac

# Must be an actual working tree — excludes the bare root and worktree-seed/,
# whose enclosing git context is the bare repo (HEAD → main) but has no work tree.
[[ "$(git -C "$dir" rev-parse --is-inside-work-tree 2>/dev/null)" == true ]] || exit 0

# Bare+sibling layout only: the shared git dir is a bare clone literally at
# <base>/.git (same probe as worktree-create.sh). Ordinary repos fail open.
common=$(git -C "$dir" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
[[ "$(basename "$common")" == .git ]] || exit 0
[[ "$(git --git-dir="$common" config --bool core.bare 2>/dev/null)" == true ]] || exit 0

branch=$(git -C "$dir" symbolic-ref --short -q HEAD) || exit 0   # detached → allow
[[ -n "$branch" ]] || exit 0

# Default branch from origin/HEAD; if unset, fall back to the conventional names.
default=$(git -C "$dir" symbolic-ref --short -q refs/remotes/origin/HEAD)
default=${default#origin/}
if [[ -z "$default" ]]; then
  case "$branch" in main|master) default=$branch ;; *) exit 0 ;; esac
fi

[[ "$branch" == "$default" ]] || exit 0   # on a feature branch → allow

repo=$(basename "$(dirname "$common")")
cat >&2 <<EOF
✗ Refusing to $verb on the default branch \`$branch\` of $repo (bare+sibling layout).
  main should only advance via merge/pull — author changes on a feature branch.
  → Create a worktree and work there:
        /worktrees $repo <branch>     (or  \$REPOS_ROOT/.new-worktree.sh $repo <branch>)
    then cd in and retry.
  Intentional? Relaunch with  WORKTREES_ALLOW_MAIN_EDITS=1 claude
  → skill: worktrees (~/.claude/skills/worktrees/SKILL.md)
EOF
exit 2
