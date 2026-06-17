#!/bin/sh
# git commit-msg hook — rejects commits whose header is not a Conventional
# Commit. Wired globally (git >= 2.54 config-based hooks) by install.sh:
#   git config --global hook.conventional-commits.event   commit-msg
#   git config --global hook.conventional-commits.command <this path>
#
# $1 = path to the commit message file. Non-zero exit rejects the commit.
# Bypass with `git commit --no-verify`. Canonical copy in the skill; edit there.
set -u
dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$dir/validate.sh"

# Header = first line that is neither a comment nor blank.
header=$(sed -e '/^[[:space:]]*#/d' -e '/^[[:space:]]*$/d' "$1" | head -n1)

cc_is_exempt "$header" && exit 0

if ! cc_header_valid "$header"; then
  cat >&2 <<EOF
✗ commit message is not a Conventional Commit:
    $header
  expected: <type>[(scope)][!]: <subject>
  types:    feat fix perf refactor docs test build ci style chore revert
  → skill: conventional-commits (~/.claude/skills/conventional-commits/SKILL.md)
EOF
  exit 1
fi
exit 0
