#!/usr/bin/env bash
# Shared provenance stamper for the vendor scripts: vendor.sh copies parts out to
# apps; sync-from-web.sh syncs the toolkit in from vanilla-web. Prepends a one-line
# comment carrying <text>, in the file's comment syntax, first stripping any existing
# line that matches <strip-pattern> so re-stamps stay clean. SOURCED, not executed.
#
#   stamp_file <file> <text> <strip-pattern>
#
# The stamp text carries sha256:<hex> of the canon bytes being copied. That hash,
# not the rev beside it, is what tools/check-vendored.mjs classifies on (docs/adr/
# 0005). Callers build it with sha256_of, and read a copy's recorded hash back with
# stamped_sha256. The stamp is ONE line: every stripper here and in
# check-vendored.mjs filters on a substring, so a second line would survive the
# strip and break the body comparison.

# sha256 of a file's TEXT, as bare hex. sha256sum is GNU; stock macOS ships only
# shasum. Both print "<hex>  <path>", so keep everything before the first space.
#
# Fed on STDIN, never by name, for two reasons. GNU coreutils escapes its output
# line with a leading backslash when the path contains one, so passing a Windows
# path yields "\<hex>" and every stamp written there carries a 65-character hash
# that matches nothing. And `tr -d '\r'` has to sit in front anyway: git checks
# the same blob out as CRLF wherever core.autocrlf is true, so hashing the bytes
# on disk would make the hash a property of the checkout rather than of canon.
# `check-vendored.mjs`'s `lf` is the same strip, and the two must agree digit for
# digit — a test in vanilla-web/tools/check-vendored.test.mjs pins that.
sha256_of() {
  local out
  if command -v sha256sum >/dev/null 2>&1; then
    out=$(tr -d '\r' < "$1" | sha256sum)
  else
    out=$(tr -d '\r' < "$1" | shasum -a 256)
  fi
  echo "${out%% *}"
}

# The sha256 recorded in <file>'s stamp, or empty when it carries none (a copy
# stamped before ADR 0005, or no copy at all). Reads the first 3 lines only, the
# same window check-vendored.mjs parses, with no forks.
# The hash is anchored to the `@<rev> ` that precedes it, the same shape
# check-vendored.mjs parses, so a bare sha256: token elsewhere in the window
# cannot be read as the record.
# The trailing `return 0` is load-bearing. A line with no match ends the body on a
# failed `[[ ]] && { ... }`, which becomes the loop's status and the function's,
# and under the caller's `set -e` that kills the script before it can report the
# copy. "No hash recorded" is an answer, not an error.
stamped_sha256() {
  [[ -f $1 ]] || return 0
  local line
  while IFS= read -r line; do
    [[ $line =~ @[^[:space:]]+[[:space:]]sha256:([0-9a-f]{64}) ]] && { echo "${BASH_REMATCH[1]}"; return 0; }
  done < <(head -n 3 "$1")
  return 0
}

stamp_file() {
  local f=$1 text=$2 strip=$3 line
  case $f in
    *.mjs|*.js) line="// $text" ;;
    *.css)      line="/* $text */" ;;
    *.html)     line="<!-- $text -->" ;;
    *)          return ;;
  esac
  # Strip any existing stamp first so re-stamps stay clean. `|| true`: grep exits
  # 1 when nothing remains (empty file, or a file that was only the old stamp),
  # which would abort the caller under `set -e`.
  local body; body=$(mktemp)
  grep -v "$strip" "$f" > "$body" || true
  # A shebang MUST stay on line 1 (else `node <file>` throws SyntaxError), so when
  # the file leads with one, slot the banner just below it; otherwise on top.
  local first=""; IFS= read -r first < "$body" || true
  local tmp; tmp=$(mktemp)
  if [[ $first == "#!"* ]]; then
    { printf '%s\n' "$first"; printf '%s\n' "$line"; tail -n +2 "$body"; } > "$tmp"
  else
    { printf '%s\n' "$line"; cat "$body"; } > "$tmp"
  fi
  mv "$tmp" "$f"
  rm -f "$body"
}
