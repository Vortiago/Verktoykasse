#!/bin/sh
# Conventional Commits validation core — POSIX sh, meant to be SOURCED by the
# commit-msg and PR-title hooks (never run directly). No deps beyond grep/sed.
#
# Canonical copy lives in the Verktøykasse `conventional-commits` skill and is
# reached through the ~/.claude/skills/conventional-commits symlink. Edit here.

CC_TYPES='feat|fix|perf|refactor|docs|test|build|ci|style|chore|revert'
CC_HEADER_RE="^(${CC_TYPES})(\([a-z0-9._-]+\))?(!)?: .+"

# cc_is_exempt FIRSTLINE — true for messages git generates itself or autosquash
# markers, which must pass through untouched (commitlint exempts these too).
cc_is_exempt() {
  case "$1" in
    'Merge '*|'Revert '*|'fixup! '*|'squash! '*|'amend! '*|'#'*|'') return 0 ;;
  esac
  return 1
}

# cc_header_valid HEADER — true if HEADER is a well-formed Conventional Commit.
cc_header_valid() {
  printf '%s' "$1" | grep -Eq "$CC_HEADER_RE"
}

# cc_severity HEADER BODY — prints breaking|feat|fix|other (assumes a valid
# header). breaking = "!" before the colon, or a BREAKING CHANGE footer.
cc_severity() {
  _h=$1; _b=${2:-}
  if printf '%s' "$_h" | grep -Eq "^(${CC_TYPES})(\([a-z0-9._-]+\))?!:" \
     || printf '%s\n' "$_b" | grep -Eq '^BREAKING[ -]CHANGE:'; then
    echo breaking; return
  fi
  case "$_h" in
    feat:*|feat\(*) echo feat ;;
    fix:*|fix\(*)   echo fix ;;
    *)              echo other ;;
  esac
}
