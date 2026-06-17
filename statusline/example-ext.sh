#!/usr/bin/env bash
# Verktøykasse statusline extension + worked example for expand-statusline.
# Contract: core runs it with status JSON on stdin + CL_* in env; declare links
# (cl_addlink), print only status. Inert without the core. See statusline/SKILL.md.
set -uo pipefail
. "${CL_LIB:?}"

root="${CL_ROOT:-$PWD}"
live="$HOME/.claude/skills"

# Local probe: skills defined here vs. linked live. name from frontmatter, not
# folder (statusline/ → expand-statusline). Slow/networked work → cl_cache instead.
total=0 active=0
for skill in "$root"/*/SKILL.md; do
  [ -e "$skill" ] || continue
  total=$((total + 1))
  name=$(sed -n 's/^name:[[:space:]]*//p' "$skill" | head -1)
  [ -n "$name" ] && [ -e "$live/$name" ] && active=$((active + 1))
done

[ -n "${CL_SLUG:-}" ] && [ -n "${CL_HOST:-}" ] \
  && cl_addlink svc "https://$CL_HOST/$CL_SLUG" "🧰"

dot=$CL_GREEN; [ "$active" -lt "$total" ] && dot=$CL_YELLOW
printf '%s🧰 skills %s/%s%s' "$dot" "$active" "$total" "$CL_RESET"
