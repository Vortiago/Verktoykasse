#!/usr/bin/env bash
# Self-test for guard-default-branch.sh. Run: bash selftest.sh
# Builds throwaway bare+sibling repos and asserts the hook blocks/allows the
# right calls. No network; uses a temp HOME-independent git identity.
set -u
dir=$(cd -- "$(dirname -- "$0")" && pwd)
hook="$dir/guard-default-branch.sh"
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fail=0

# Build a bare+sibling repo with default branch $1, a `feature` sibling, and a
# real refs/remotes/origin/HEAD (as clone-bare.sh produces). Echoes its <base>.
mkrepo() { # $1 = default branch name — echoes <base>; git chatter stays off stdout
  local def=$1 src="$tmp/src-$1" base="$tmp/repo-$1"
  {
    git init -q -b "$def" "$src"
    git -C "$src" commit -q --allow-empty -m "chore: init"
    git clone -q --bare "$src" "$base/.git"
    git -C "$base" config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
    git -C "$base" fetch -q --prune origin
    git -C "$base" remote set-head origin -a
    git -C "$base" worktree add -q "$base/$def" "$def"
    git -C "$base" worktree add -q -b feature "$base/feature" "$def"
  } >&2
  printf '%s' "$base"
}

# Run the hook with a synthesized PreToolUse payload; assert the exit code.
ck() { # desc  want(0 allow / 2 block)  json  [env assignment]
  local rc
  if [ -n "${4:-}" ]; then
    out=$(printf '%s' "$3" | env "$4" bash "$hook" 2>/dev/null); rc=$?
  else
    out=$(printf '%s' "$3" | bash "$hook" 2>/dev/null); rc=$?
  fi
  if [ "$rc" = "$2" ]; then echo "ok   $1"
  else echo "FAIL $1 (rc=$rc want=$2)"; fail=1; fi
}
edit() { jq -nc --arg p "$1" --arg c "$2" '{tool_name:"Edit",tool_input:{file_path:$p},cwd:$c}'; }
nb()   { jq -nc --arg p "$1" --arg c "$2" '{tool_name:"NotebookEdit",tool_input:{notebook_path:$p},cwd:$c}'; }
bash_() { jq -nc --arg x "$1" --arg c "$2" '{tool_name:"Bash",tool_input:{command:$x},cwd:$c}'; }

base=$(mkrepo main)

# --- edit-tool paths ---
ck "edit on default (main)"        2 "$(edit "$base/main/f.txt" "$base/main")"
ck "edit on feature branch"        0 "$(edit "$base/feature/f.txt" "$base/feature")"
ck "new file, uncreated subdir"    2 "$(edit "$base/main/a/b/c.txt" "$base/main")"
ck "NotebookEdit on default"       2 "$(nb   "$base/main/n.ipynb" "$base/main")"
ck "env override disables guard"   0 "$(edit "$base/main/f.txt" "$base/main")" "WORKTREES_ALLOW_MAIN_EDITS=1"

# --- fail-open: not a work tree / not bare+sibling ---
ck "loose file, non-git dir"       0 "$(edit "$tmp/loose.txt" "$tmp")"
ck "bare root (has .git, no tree)" 0 "$(edit "$base/x.txt" "$base")"

# --- Bash authoring vs. legitimate main advancement ---
ck "git commit on default"         2 "$(bash_ "git commit -m x" "$base/main")"
ck "git add on default"            2 "$(bash_ "git add ."        "$base/main")"
ck "git pull on default"           0 "$(bash_ "git pull"         "$base/main")"
ck "git merge on default"          0 "$(bash_ "git merge origin/main" "$base/main")"
ck "git commit on feature"         0 "$(bash_ "git commit -m x" "$base/feature")"
ck "non-git-author Bash on main"   0 "$(bash_ "ls -la"          "$base/main")"

# --- origin/HEAD detection beats the {main,master} fallback ---
trunk=$(mkrepo trunk)
ck "edit on default (trunk)"       2 "$(edit "$trunk/trunk/f.txt" "$trunk/trunk")"
ck "edit on feature (trunk repo)"  0 "$(edit "$trunk/feature/f.txt" "$trunk/feature")"

# --- fallback path: origin/HEAD unset, branch is main → still blocks ---
git -C "$base" remote set-head origin -d >&2
ck "fallback: main, no origin/HEAD" 2 "$(edit "$base/main/f.txt" "$base/main")"

if [ "$fail" = 0 ]; then echo "ALL PASS"; else echo "FAILURES"; exit 1; fi
