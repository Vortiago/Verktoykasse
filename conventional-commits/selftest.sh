#!/bin/sh
# Self-test for validate.sh. Run: sh selftest.sh   (no git/repo needed)
set -u
dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$dir/validate.sh"
fail=0

ck() { # desc  want(0 valid/1 invalid)  header
  if cc_header_valid "$3"; then got=0; else got=1; fi
  if [ "$got" != "$2" ]; then echo "FAIL valid : $1 (got=$got want=$2): $3"; fail=1; else echo "ok   $1"; fi
}
cks() { # desc  want-severity  header  [body]
  got=$(cc_severity "$3" "${4:-}")
  if [ "$got" != "$2" ]; then echo "FAIL sev   : $1 (got=$got want=$2)"; fail=1; else echo "ok   $1"; fi
}
cke() { # desc  want(0 exempt/1 not)  firstline
  if cc_is_exempt "$3"; then got=0; else got=1; fi
  if [ "$got" != "$2" ]; then echo "FAIL exempt: $1 (got=$got want=$2): $3"; fail=1; else echo "ok   $1"; fi
}

ck  "feat"            0 "feat: add thing"
ck  "fix scope"       0 "fix(api): correct null"
ck  "feat!"           0 "feat!: drop v1"
ck  "scope!"          0 "feat(api)!: drop v1"
ck  "chore"           0 "chore: bump deps"
ck  "revert type"     0 "revert: feat: x"
ck  "bad type"        1 "feature: nope"
ck  "no colon"        1 "feat add thing"
ck  "no space"        1 "feat:x"
ck  "empty subject"   1 "feat: "
ck  "capitalised"     1 "Feat: x"

cks "feat sev"        feat     "feat: x"
cks "fix sev"         fix      "fix(api): x"
cks "bang breaking"   breaking "feat!: x"
cks "scope! breaking" breaking "refactor(core)!: x"
cks "footer breaking" breaking "feat: x" "body
BREAKING CHANGE: gone"
cks "perf other"      other    "perf: x"
cks "docs other"      other    "docs: x"

cke "merge"           0 "Merge branch 'main'"
cke "revert default"  0 'Revert "feat: x"'
cke "fixup"           0 "fixup! feat: x"
cke "squash"          0 "squash! feat: x"
cke "empty"           0 ""
cke "normal not exem" 1 "feat: x"

if [ "$fail" = 0 ]; then echo "ALL PASS"; else echo "FAILURES"; exit 1; fi
