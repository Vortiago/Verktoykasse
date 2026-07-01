#!/usr/bin/env bash
# Shared provenance stamper for the vendor scripts: vendor.sh copies parts out to
# apps; sync-from-web.sh syncs the toolkit in from vanilla-web. Prepends a one-line
# comment carrying <text>, in the file's comment syntax, first stripping any existing
# line that matches <strip-pattern> so re-stamps stay clean. SOURCED, not executed.
#
#   stamp_file <file> <text> <strip-pattern>

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
