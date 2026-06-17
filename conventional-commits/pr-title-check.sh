#!/bin/sh
# Claude Code PreToolUse(Bash) hook — validates the title of `gh pr create` /
# `gh pr edit` as a Conventional Commit, and flags a breaking-change UNDER-report
# against the branch's commits (the title is squash-merged, so it is the moniker
# that ships). Canonical copy in the skill; registered in settings.json by
# install.sh against ~/.claude/skills/conventional-commits/pr-title-check.sh.
#
# Contract: stdin JSON {tool_name, tool_input.command}. exit 2 + stderr blocks
# the tool call (Claude sees the reason); exit 0 allows. Fails OPEN — anything
# it cannot parse is allowed, so it never blocks a command it cannot read.
set -u
dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$dir/validate.sh"

input=$(cat)
tool=$(printf '%s' "$input" | jq -r '.tool_name // empty')
cmd=$(printf '%s'  "$input" | jq -r '.tool_input.command // empty')

[ "$tool" = Bash ] || exit 0
case "$cmd" in *"gh pr create"*|*"gh pr edit"*) ;; *) exit 0 ;; esac

# Best-effort title extraction for the forms Claude emits: --title "X" | -t 'X'
# | --title=X. First match wins; empty → fail open.
extract_title() {
  t=$(printf '%s' "$1" | sed -nE 's/.*(--title|-t)[= ]+"([^"]*)".*/\2/p'); [ -n "$t" ] && { printf '%s' "$t"; return; }
  t=$(printf '%s' "$1" | sed -nE "s/.*(--title|-t)[= ]+'([^']*)'.*/\2/p"); [ -n "$t" ] && { printf '%s' "$t"; return; }
  printf '%s' "$1" | sed -nE 's/.*(--title|-t)[= ]+([^ ]+).*/\2/p'
}
title=$(extract_title "$cmd")
[ -n "$title" ] || exit 0

if ! cc_header_valid "$title"; then
  cat >&2 <<EOF
✗ PR title is not a Conventional Commit:
    $title
  expected: <type>[(scope)][!]: <subject>
  → skill: conventional-commits (~/.claude/skills/conventional-commits/SKILL.md)
EOF
  exit 2
fi

# Breaking under-report: the title is non-breaking but a branch commit is
# breaking. base = merge-base with the remote default branch; skip if unknown.
[ "$(cc_severity "$title" "")" = breaking ] && exit 0
base=$(git merge-base HEAD origin/HEAD 2>/dev/null) || base=
[ -n "$base" ] || exit 0

brk=$(git log --format='%s' "$base"..HEAD 2>/dev/null \
      | grep -Eq "^(feat|fix|perf|refactor|docs|test|build|ci|style|chore|revert)(\([a-z0-9._-]+\))?!:" && echo y)
[ -n "$brk" ] || brk=$(git log --format='%B%x00' "$base"..HEAD 2>/dev/null \
      | grep -Eq '^BREAKING[ -]CHANGE:' && echo y)

if [ -n "$brk" ]; then
  cat >&2 <<EOF
✗ PR title under-reports a breaking change.
  The branch has a breaking commit, but the title omits "!":
    $title
  Either (a) the change is breaking → add "!": ${title%%:*}!:${title#*:}
  or (b) the breaking commit was reverted/superseded and is not in the net diff
         → rewrite branch history (git rebase -i $base: reword/squash/drop the
           stale "!" commit) so none remains, then retry.
  → skill: conventional-commits (~/.claude/skills/conventional-commits/SKILL.md)
EOF
  exit 2
fi
exit 0
