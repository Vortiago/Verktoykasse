#!/usr/bin/env bash
# Sync the shared toolkit files from the vanilla-web skill (the canon) into this
# skill's tree. vanilla-web is the engine; these files are byte-identical copies
# that must not drift — edit them in vanilla-web, then run this to re-vendor.
# See ../docs/adr/0001-vendored-toolkit-not-symlink.md.
#
#   ./sync-from-web.sh             re-vendor the toolkit files (stamps a provenance header)
#   ./sync-from-web.sh --check     verify every copy matches canon; non-zero on drift
#   ./sync-from-web.sh --precommit --check, but only when a toolkit file is staged
#                                  (used by the repo's git pre-commit hook)
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
WEB="$ROOT/vanilla-web"
COMP="$ROOT/vanilla-components"

# canon (under vanilla-web) | vendored copy (under vanilla-components)
PAIRS=(
  "serve.mjs|serve.mjs"
  "preview.js|preview.js"
  "preview.css|preview.css"
  "previews/scan.mjs|previews/scan.mjs"
  "previews/new.mjs|previews/new.mjs"
  "templates.js|lib/templates.js"
)

strip="canonical source: vanilla-web"   # must be a prefix of the sync-mode stamp text
mode=${1:-sync}

# Compares files in the WORKING TREE (not staged blobs) — a deliberate simplification
# matching the edit-canon → sync → add → commit flow. Catches the main case (canon
# edited, copy not re-synced); a contrived stage-then-restore can slip past --precommit.
check() {
  local drift=0 pair canon vend
  for pair in "${PAIRS[@]}"; do
    canon=${pair%%|*}; vend=${pair##*|}
    # compare canon against the vendored copy with its stamp line stripped
    if [[ ! -f $COMP/$vend ]] || ! diff -q "$WEB/$canon" <(grep -v "$strip" "$COMP/$vend") >/dev/null; then
      echo "drift: vanilla-components/$vend is stale vs vanilla-web/$canon" >&2
      drift=1
    fi
  done
  if [[ $drift -ne 0 ]]; then
    echo "vendored toolkit is stale — run vanilla-components/sync-from-web.sh and re-stage" >&2
    return 1
  fi
}

case $mode in
  --check) check ;;
  --precommit)
    # Guard: only run the check when a canon or vendored file is actually staged.
    # Derive the repo-relative dirs from $WEB/$COMP so a skill rename can't silently
    # desync the guard from the staged paths git reports.
    staged=$(git -C "$ROOT" diff --cached --name-only)
    web_rel=${WEB#"$ROOT/"}; comp_rel=${COMP#"$ROOT/"}
    for pair in "${PAIRS[@]}"; do
      canon=${pair%%|*}; vend=${pair##*|}
      if grep -qxF "$web_rel/$canon" <<<"$staged" || grep -qxF "$comp_rel/$vend" <<<"$staged"; then
        check   # set -e: a stale copy aborts the commit here
        break
      fi
    done
    ;;
  sync)
    source "$COMP/lib-stamp.sh"
    rev=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
    for pair in "${PAIRS[@]}"; do
      canon=${pair%%|*}; vend=${pair##*|}
      mkdir -p "$(dirname "$COMP/$vend")"
      cp "$WEB/$canon" "$COMP/$vend"
      stamp_file "$COMP/$vend" \
        "canonical source: vanilla-web/$canon@$rev — vendored copy, do not edit here" \
        "$strip"
      echo "vendored $canon -> vanilla-components/$vend (@$rev)"
    done
    ;;
  *) echo "usage: sync-from-web.sh [--check|--precommit]" >&2; exit 2 ;;
esac
