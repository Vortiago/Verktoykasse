#!/usr/bin/env bash
# Copy a vanilla-components part into an app, verbatim, with a provenance header.
# Copy-verbatim is the distribution model (no package, no symlink) — the app
# stays self-contained and statically servable. Re-run to update; never fork.
#
#   ./vendor.sh <component> <dest-dir>   e.g. ./vendor.sh panel ../myapp/web/components
#   ./vendor.sh tokens <dest-dir>        copies tokens.css into <dest-dir>
#   ./vendor.sh tones <dest-dir>         copies tones.css (the shared tone mixin —
#                                        required by any tone-bearing component)
#
# <dest-dir> for a component is the app's components/ (sibling of lib/), since the
# component imports ../../lib/templates.js — that relative shape must hold.
#
# Dev/sync-only sidecars (<name>.preview.js, .test.mjs, .bridge.mjs) are NOT
# vendored; the component's .html/.css/.js are self-contained and only need
# lib/templates.js (+ tones.css for a tone-bearing component).
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
what=${1:?usage: vendor.sh <component|tokens|tones> <dest-dir>}
dest=${2:?usage: vendor.sh <component|tokens|tones> <dest-dir>}
rev=$(git -C "$HERE" rev-parse --short HEAD 2>/dev/null || echo unknown)
stamp="from vanilla-components@$rev - re-copy to update, don't fork"

mkdir -p "$dest"

# Provenance stamping is shared with sync-from-web.sh (stamp_file <file> <text>
# <strip-pattern>). Re-stamping strips the old header first, so updates stay clean.
strip="from vanilla-components@"
source "$HERE/lib-stamp.sh"

if [ "$what" = tokens ]; then
  cp "$HERE/tokens.css" "$dest/tokens.css"
  stamp_file "$dest/tokens.css" "$stamp" "$strip"
  echo "vendored tokens.css -> $dest/tokens.css (@$rev)"
  exit 0
fi

if [ "$what" = tones ]; then
  cp "$HERE/tones.css" "$dest/tones.css"
  stamp_file "$dest/tones.css" "$stamp" "$strip"
  echo "vendored tones.css -> $dest/tones.css (@$rev)"
  exit 0
fi

src="$HERE/components/$what"
[ -d "$src" ] || { echo "no such component: components/$what" >&2; exit 1; }
out="$dest/$what"
rm -rf "$out"
cp -R "$src" "$out"
rm -f "$out"/*.preview.js "$out"/*.test.mjs "$out"/*.bridge.mjs
for f in "$out"/*; do stamp_file "$f" "$stamp" "$strip"; done
echo "vendored $what -> $out (@$rev)"
