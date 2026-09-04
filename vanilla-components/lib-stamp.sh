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
# 0004). Callers build it with sha256_of, and read a copy's recorded values back
# with stamped_sha256 / stamped_rev. The stamp is ONE line: every stripper here and
# in check-vendored.mjs filters on a substring, so a second line would survive the
# strip and break the body comparison.

# sha256 of a file's bytes, as bare hex. sha256sum is GNU; stock macOS ships only
# shasum. Both print "<hex>  <path>", so cut the first field.
sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# The sha256 recorded in <file>'s stamp, or empty when it carries none (a copy
# stamped before ADR 0004, or no copy at all). Reads the first 3 lines only, the
# same window check-vendored.mjs parses.
stamped_sha256() {
  [[ -f $1 ]] || return 0
  head -n 3 "$1" | grep -o 'sha256:[0-9a-f]\{64\}' | head -n 1 | cut -d: -f2
}

# The rev recorded in <file>'s stamp, or empty when it carries none. sync-from-web.sh
# keeps this rev when the bytes have not moved, so a re-sync touches only the copies
# that actually changed instead of rewriting all 15 stamps.
stamped_rev() {
  [[ -f $1 ]] || return 0
  head -n 3 "$1" | grep -o '@[0-9a-z]\{7,40\} sha256:' | head -n 1 | sed 's/^@//; s/ sha256:$//'
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
