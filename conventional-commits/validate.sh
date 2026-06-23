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

# --- PR command helpers (sourced by pr-title-check.sh) --------------------
# Heuristic parsing of a `gh`/`az` PR open/edit command string; first match wins.

# pr_body_value CMD FLAG_ERE — print a body flag's value (FLAG_ERE e.g.
# '--body|-b' or '--description|-d'). Quoted forms win over a bare token (sed `t`)
# so empty quotes stay empty instead of capturing the literal "". exit 0 if the
# flag is present (value may be empty), 1 if absent.
pr_body_value() {
  _c=$1; _f=$2
  printf '%s' "$_c" | grep -Eq "(^| )(${_f})[= ]" || return 1
  printf '%s' "$_c" | sed -nE "
    s/.*(${_f})[= ]+\"([^\"]*)\".*/\2/p ; t
    s/.*(${_f})[= ]+'([^']*)'.*/\2/p ; t
    s/.*(${_f})[= ]+([^ ]+).*/\2/p"
  return 0
}

# pr_body_missing CMD CLI MODE — true (0) if the command ships an empty/missing
# body (block it). CLI=gh|az, MODE=create|edit. On edit only an explicit empty
# body counts (absent = leaving it unchanged). Fails OPEN (1) on ambiguity:
# non-inline gh sources (--body-file/-F/--fill*/--template/--web) count as a body.
pr_body_missing() {
  _c=$1; _cli=$2; _mode=$3
  case "$_cli" in
    gh) _f='--body|-b' ;;
    az) _f='--description|-d' ;;
    *)  return 1 ;;
  esac
  if _v=$(pr_body_value "$_c" "$_f"); then
    case "$_v" in *[![:space:]]*) return 1 ;; esac   # has real content → ok
    return 0                                          # present but empty
  fi
  if [ "$_cli" = gh ]; then
    case "$_c" in
      *--body-file*|*--fill*|*--template*|*--web*|*' -F '*|*' -F='*) return 1 ;;
    esac
  fi
  [ "$_mode" = create ] && return 0                   # create with no body at all
  return 1
}
