#!/usr/bin/env bash
# Sync the test-audit core (the canon) into this plugin's core/. OpenCode installs
# only the `path:` directory of a GitHub plugin, so the plugin cannot import
# ../test-audit at run time: it carries a committed, stamped copy of every module
# the audit loads. Edit the modules in test-audit, then run this to re-vendor.
# The same pattern as vanilla-components/sync-from-web.sh; see
# ../docs/adr/0001-vendored-toolkit-not-symlink.md and 0005.
#
#   ./sync-from-test-audit.sh             re-vendor the core (stamps a provenance header)
#   ./sync-from-test-audit.sh --check     verify every copy's body AND stamped sha256
#                                         against canon, and that core/ holds no other
#                                         file; non-zero on drift
#   ./sync-from-test-audit.sh --precommit --check, but only when a core file is staged
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
CANON="$ROOT/test-audit"
CORE="$ROOT/opencode-test-audit/core"

# The modules audit.mjs and report/index.mjs load, and the types their JSDoc
# names. Each lands at the same relative path under core/, so the relative
# imports between them resolve unchanged. A new import in the core is a new line.
FILES=(
  audit.mjs
  config.mjs
  types.d.ts
  change/code-only.mjs
  change/collect.mjs
  change/extract.mjs
  change/index.mjs
  checks/index.mjs
  checks/asserts/check.mjs
  checks/automated/check.mjs
  checks/can-fail/check.mjs
  checks/conditional/check.mjs
  checks/deterministic/check.mjs
  checks/isolated/check.mjs
  checks/positive/check.mjs
  checks/restores/check.mjs
  checks/runs/check.mjs
  checks/verdict/check.mjs
  classifier/finding.mjs
  classifier/index.mjs
  classifier/systemone.mjs
  classifier/verdict.mjs
  lib/pool.mjs
  report/brief.mjs
  report/format.mjs
  report/index.mjs
  report/markdown.mjs
  report/text.mjs
  tools/js-scan.mjs
)

strip="canonical source: test-audit"   # must be a prefix of the sync-mode stamp text
mode=${1:-sync}
source "$ROOT/vanilla-components/lib-stamp.sh"   # stamp_file / sha256_of / stamped_sha256

# True when the copy's body, stamp line stripped, matches canon. CR-stripped on
# both sides, as in sync-from-web.sh. tools/js-scan.mjs keeps its own
# vanilla-web stamp: it is part of the canon body here.
body_matches() {
  [[ -f $CORE/$1 ]] &&
    diff -q <(tr -d '\r' < "$CANON/$1") <(grep -v "$strip" "$CORE/$1" | tr -d '\r') >/dev/null
}

check() {
  local drift=0 file want got
  for file in "${FILES[@]}"; do
    if ! body_matches "$file"; then
      echo "drift: opencode-test-audit/core/$file is stale vs test-audit/$file" >&2
      drift=1
      continue
    fi
    want=$(sha256_of "$CANON/$file"); got=$(stamped_sha256 "$CORE/$file")
    if [[ $got != "$want" ]]; then
      echo "stamp: opencode-test-audit/core/$file records sha256:${got:-none}, canon is sha256:$want" >&2
      drift=1
    fi
  done
  # A file in core/ that is not on the list is a module the canon dropped or a
  # hand-added one; either way the copy no longer mirrors the canon.
  while IFS= read -r file; do
    if ! printf '%s\n' "${FILES[@]}" | grep -qxF "$file"; then
      echo "extra: opencode-test-audit/core/$file is not in the core list" >&2
      drift=1
    fi
  done < <(cd "$CORE" && find . -type f | sed 's|^\./||' | sort)
  if [[ $drift -ne 0 ]]; then
    echo "vendored core is stale — run opencode-test-audit/sync-from-test-audit.sh and re-stage" >&2
    return 1
  fi
}

case $mode in
  --check) check ;;
  --precommit)
    staged=$(git -C "$ROOT" diff --cached --name-only)
    for file in "${FILES[@]}"; do
      if grep -qxF "test-audit/$file" <<<"$staged" || grep -qxF "opencode-test-audit/core/$file" <<<"$staged"; then
        check
        break
      fi
    done
    ;;
  sync)
    rev=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)
    for file in "${FILES[@]}"; do
      sum=$(sha256_of "$CANON/$file")
      # Leave a copy that already carries these bytes alone (docs/adr/0005).
      if [[ $(stamped_sha256 "$CORE/$file") == "$sum" ]] && body_matches "$file"; then
        continue
      fi
      mkdir -p "$(dirname "$CORE/$file")"
      cp "$CANON/$file" "$CORE/$file"
      stamp_file "$CORE/$file" \
        "canonical source: test-audit/$file@$rev sha256:$sum - vendored copy, do not edit here" \
        "$strip"
      echo "vendored test-audit/$file -> opencode-test-audit/core/$file (@$rev sha256:${sum:0:12})"
    done
    ;;
  *) echo "usage: sync-from-test-audit.sh [--check|--precommit]" >&2; exit 2 ;;
esac
