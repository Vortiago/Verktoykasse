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
  local tmp; tmp=$(mktemp)
  # `|| true`: grep exits 1 when nothing remains (empty file, or a file that was
  # only the old stamp), which would abort the caller under `set -e`.
  { printf '%s\n' "$line"; grep -v "$strip" "$f" || true; } > "$tmp"
  mv "$tmp" "$f"
}
