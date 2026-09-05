#!/usr/bin/env bash
# Sync the shared toolkit files from the vanilla-web skill (the canon) into this
# skill's tree. vanilla-web is the engine; these files are byte-identical copies
# that must not drift — edit them in vanilla-web, then run this to re-vendor.
# See ../docs/adr/0001-vendored-toolkit-not-symlink.md.
#
#   ./sync-from-web.sh             re-vendor the toolkit files (stamps a provenance header)
#   ./sync-from-web.sh --check     verify every copy's body AND stamped sha256 against
#                                  canon; non-zero on drift
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
  "preview-source.js|preview-source.js"
  "preview.css|preview.css"
  "previews/scan.mjs|previews/scan.mjs"
  "previews/new.mjs|previews/new.mjs"
  "previews/naming.mjs|previews/naming.mjs"
  "templates.js|lib/templates.js"
  "render.js|lib/render.js"
  "chrome.js|lib/chrome.js"
  "tools/check.mjs|tools/check.mjs"
  "tools/check-css-vars.mjs|tools/check-css-vars.mjs"
  "tools/check-slots.mjs|tools/check-slots.mjs"
  "tools/check-conventions.mjs|tools/check-conventions.mjs"
  "tools/js-scan.mjs|tools/js-scan.mjs"
)

strip="canonical source: vanilla-web"   # must be a prefix of the sync-mode stamp text
mode=${1:-sync}
source "$COMP/lib-stamp.sh"             # stamp_file / sha256_of / stamped_sha256

# Compares files in the WORKING TREE (not staged blobs) — a deliberate simplification
# matching the edit-canon → sync → add → commit flow. Catches the main case (canon
# edited, copy not re-synced); a contrived stage-then-restore can slip past --precommit.
#
# Two comparisons, not one. The body diff is the original check. The sha256 check is
# what puts the stamp's own claim under CI: the body can match canon while the stamp
# records a hash of something else, and nothing else in the gate reads that value.
# True when the vendored copy's body, stamp line stripped, matches canon.
# Shared by --check and by sync mode's skip, so the two cannot disagree about
# what "unchanged" means. <canon-path> <vendored-path>, both relative.
body_matches() {
  [[ -f $COMP/$2 ]] && diff -q "$WEB/$1" <(grep -v "$strip" "$COMP/$2") >/dev/null
}

check() {
  local drift=0 pair canon vend want got
  for pair in "${PAIRS[@]}"; do
    canon=${pair%%|*}; vend=${pair##*|}
    if ! body_matches "$canon" "$vend"; then
      echo "drift: vanilla-components/$vend is stale vs vanilla-web/$canon" >&2
      drift=1
      continue
    fi
    want=$(sha256_of "$WEB/$canon"); got=$(stamped_sha256 "$COMP/$vend")
    if [[ $got != "$want" ]]; then
      echo "stamp: vanilla-components/$vend records sha256:${got:-none}, canon is sha256:$want" >&2
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
    rev=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
    for pair in "${PAIRS[@]}"; do
      canon=${pair%%|*}; vend=${pair##*|}
      sum=$(sha256_of "$WEB/$canon")
      # Leave a copy that already carries these bytes alone. Re-stamping it would
      # write a new HEAD over a rev that still describes the same bytes, so a
      # one-file canon change would land as a 15-file diff in which 14 files change
      # only a rev that no longer classifies anything (docs/adr/0004). Both halves
      # are needed: a hand-edited body can still carry a correct stamp.
      if [[ $(stamped_sha256 "$COMP/$vend") == "$sum" ]] && body_matches "$canon" "$vend"; then
        continue
      fi
      mkdir -p "$(dirname "$COMP/$vend")"
      cp "$WEB/$canon" "$COMP/$vend"
      stamp_file "$COMP/$vend" \
        "canonical source: vanilla-web/$canon@$rev sha256:$sum - vendored copy, do not edit here" \
        "$strip"
      echo "vendored $canon -> vanilla-components/$vend (@$rev sha256:${sum:0:12})"
    done
    ;;
  *) echo "usage: sync-from-web.sh [--check|--precommit]" >&2; exit 2 ;;
esac
