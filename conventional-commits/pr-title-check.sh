#!/bin/sh
# Claude Code PreToolUse(Bash) hook — validates a PR open/edit command
# (`gh pr create`/`gh pr edit`, `az repos pr create`/`az repos pr update`): the
# title must be a Conventional Commit, the body must be non-empty (it
# squash-merges into the commit body), and a breaking-change UNDER-report against
# the branch's commits is flagged (the title is the moniker that ships).
# Canonical copy in the skill; registered in settings.json by
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

# Which forge CLI is opening/editing a PR, and which flag carries the title?
# gh takes --title or -t; az takes only --title — az's -t is --target-branch
# (-s --source-branch, -d --description), so reusing -t here would validate the
# wrong value. Unmatched commands fail open.
case "$cmd" in
  *"gh pr create"*)        cli=gh; mode=create; titleflag='--title|-t' ;;
  *"gh pr edit"*)          cli=gh; mode=edit;   titleflag='--title|-t' ;;
  *"az repos pr create"*)  cli=az; mode=create; titleflag='--title' ;;
  *"az repos pr update"*)  cli=az; mode=edit;   titleflag='--title' ;;
  *) exit 0 ;;
esac

# Best-effort title extraction for the forms Claude emits: --title "X" | -t 'X'
# | --title=X. First match wins; empty → fail open.
extract_title() { # $1 = command, $2 = title-flag alternation (ERE)
  t=$(printf '%s' "$1" | sed -nE "s/.*($2)[= ]+\"([^\"]*)\".*/\2/p"); [ -n "$t" ] && { printf '%s' "$t"; return; }
  t=$(printf '%s' "$1" | sed -nE "s/.*($2)[= ]+'([^']*)'.*/\2/p"); [ -n "$t" ] && { printf '%s' "$t"; return; }
  printf '%s' "$1" | sed -nE "s/.*($2)[= ]+([^ ]+).*/\2/p"
}
title=$(extract_title "$cmd" "$titleflag")

# 1. Title must be a Conventional Commit — when present (an edit may omit it).
if [ -n "$title" ] && ! cc_header_valid "$title"; then
  cat >&2 <<EOF
✗ PR title is not a Conventional Commit:
    $title
  expected: <type>[(scope)][!]: <subject>
  → skill: conventional-commits (~/.claude/skills/conventional-commits/SKILL.md)
EOF
  exit 2
fi

# 2. PR body must not be empty — it squash-merges into the commit body.
if pr_body_missing "$cmd" "$cli" "$mode"; then
  cat >&2 <<EOF
✗ PR body is empty — it squash-merges into the commit body.
  Add a one-line why: gh --body "<why>" (or --body-file/--fill); az --description "<why>".
  → skill: conventional-commits (~/.claude/skills/conventional-commits/SKILL.md)
EOF
  exit 2
fi

# 3. Breaking under-report: a non-breaking title but a breaking branch commit.
# Needs a title; base = merge-base with the remote default branch, skip if unknown.
[ -n "$title" ] || exit 0
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
