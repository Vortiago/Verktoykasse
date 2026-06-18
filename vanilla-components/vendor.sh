#!/usr/bin/env bash
# Copy a vanilla-components part into an app, verbatim, with a provenance header.
# Copy-verbatim is the distribution model (no package, no symlink) — the app
# stays self-contained and statically servable. Re-run to update; never fork.
#
#   ./vendor.sh <component> <dest-dir>   e.g. ./vendor.sh panel ../myapp/web/components
#   ./vendor.sh tokens <dest-dir>        copies tokens.css into <dest-dir>
#
# <dest-dir> for a component is the app's components/ (sibling of lib/), since the
# component imports ../../lib/templates.js — that relative shape must hold.
#
# The dev-only <name>.preview.js is NOT vendored (it needs the preview harness);
# the component's .html/.css/.js are self-contained and only need lib/templates.js.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
what=${1:?usage: vendor.sh <component|tokens> <dest-dir>}
dest=${2:?usage: vendor.sh <component|tokens> <dest-dir>}
rev=$(git -C "$HERE" rev-parse --short HEAD 2>/dev/null || echo unknown)
stamp="from vanilla-components@$rev - re-copy to update, don't fork"

mkdir -p "$dest"

# Prepend the right comment syntax for the file extension. Re-stamping a file
# that already carries our header first strips the old one, so updates stay clean.
stamp_file() {
  local f=$1 line
  case $f in
    *.js)   line="// $stamp" ;;
    *.css)  line="/* $stamp */" ;;
    *.html) line="<!-- $stamp -->" ;;
    *)      return ;;
  esac
  local tmp; tmp=$(mktemp)
  # `|| true`: grep exits 1 when nothing remains (empty file, or a file that was
  # only the old stamp), which would abort the whole script under `set -e`.
  { printf '%s\n' "$line"; grep -v 'from vanilla-components@' "$f" || true; } > "$tmp"
  mv "$tmp" "$f"
}

if [ "$what" = tokens ]; then
  cp "$HERE/tokens.css" "$dest/tokens.css"
  stamp_file "$dest/tokens.css"
  echo "vendored tokens.css -> $dest/tokens.css (@$rev)"
  exit 0
fi

src="$HERE/components/$what"
[ -d "$src" ] || { echo "no such component: components/$what" >&2; exit 1; }
out="$dest/$what"
rm -rf "$out"
cp -R "$src" "$out"
rm -f "$out"/*.preview.js
for f in "$out"/*; do stamp_file "$f"; done
echo "vendored $what -> $out (@$rev)"
