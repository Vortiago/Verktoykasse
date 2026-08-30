#!/usr/bin/env bash
# Link the live skill paths to this repo (dotfiles pattern). Idempotent.
# A real directory at a live path is backed up to <path>.pre-verktoykasse
# rather than overwritten.
#
# The CALLER decides target + skills; this installer holds NO skill->CLI policy,
# only where each CLI keeps its skills (TARGET_DIR).
#
# Usage:
#   ./install.sh [skill...]                     install (all, or the named) for Claude
#   ./install.sh --target opencode [skill...]   install for OpenCode (plain symlink, no hooks)
#
# Targets: claude (default) | opencode.
# A skill's own <skill>/install.sh (hooks / extra setup) is Claude-specific, so it is
# sourced ONLY for the claude target; every other target gets a plain symlink of the dir.
set -euo pipefail

HERE=$(dirname "$(readlink -f "$0")")

# Git Bash defaults to COPYING on `ln -s`, which is silent and defeats the whole
# dotfiles pattern: the live path stops tracking the repo, and the next run cannot
# even fix it, because backing the copy up hits a non-empty .pre-verktoykasse.
# nativestrict makes ln create a real symlink, or fail loudly instead of copying.
# It needs Developer Mode or an elevated shell; the check below reports that.
# No effect off Windows, where MSYS is not read.
export MSYS=winsymlinks:nativestrict

# Where each CLI keeps its skills. A function (not a `declare -A` associative
# array) so this runs on macOS's stock bash 3.2, which predates `declare -A`.
target_dir() { # $1 = target name — prints its skills dir, empty if unknown
  case $1 in
    claude)   echo "$HOME/.claude/skills" ;;
    opencode) echo "$HOME/.config/opencode/skills" ;;
  esac
}
KNOWN_TARGETS="claude opencode"
TARGET=claude

link() { # $1 = repo dir, $2 = live path
  local target=$1 live=$2
  if [[ -L $live ]]; then
    [[ $(readlink -f "$live") == "$target" ]] && { echo "ok      $live"; return; }
    rm "$live"
  elif [[ -e $live ]]; then
    # Back up whatever is really there, once. A second run must not fail because
    # the first already took the name: keep the ORIGINAL backup (it is the more
    # pristine one) and discard the later copy.
    if [[ -e $live.pre-verktoykasse ]]; then
      echo "backup  $live.pre-verktoykasse exists, discarding the newer copy"
      rm -rf "$live"
    else
      mv "$live" "$live.pre-verktoykasse"
      echo "backup  $live -> $live.pre-verktoykasse"
    fi
  fi
  mkdir -p "$(dirname "$live")"
  ln -s "$target" "$live"
  # MSYS=winsymlinks:nativestrict should make a failure loud, but a silent copy
  # is the exact failure this pattern cannot survive, so check rather than trust.
  [[ -L $live ]] || {
    echo "error: $live is a copy, not a symlink." >&2
    echo "       On Windows, enable Developer Mode or run from an elevated shell." >&2
    return 1
  }
  echo "linked  $live -> $target"
}

install_skill() { # $1 = skill name — installed for the current $TARGET
  # NOTE: skills are keyed by DIRECTORY name here; a skill's invocation name comes
  # from its SKILL.md `name:` frontmatter and may differ — e.g. the `statusline/`
  # dir is invoked as `/expand-statusline`.
  local name=$1
  [[ -d "$HERE/$name" ]] || { echo "error: no skill '$name' in $HERE" >&2; return 1; }
  # SKILL.md is what makes a directory a skill, so its absence is what makes one not.
  # Keyed on the file rather than on a list of names: `docs/` (ADRs) and `oclaude/`
  # (a PowerShell launcher the user runs) are both not skills, and neither is
  # whatever lands here next.
  [[ -f "$HERE/$name/SKILL.md" ]] || { echo "skip    $name (no SKILL.md, not a skill)"; return; }
  if [[ $TARGET == claude && -f "$HERE/$name/install.sh" ]]; then
    # Claude-specific hooks / extra setup — only for the claude target.
    # shellcheck source=/dev/null
    source "$HERE/$name/install.sh"
  else
    link "$HERE/$name" "$(target_dir "$TARGET")/$name"
  fi
}

skills=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --target) TARGET=${2:?--target needs a value}; shift 2 ;;
    --target=*) TARGET=${1#*=}; shift ;;
    *) skills+=("$1"); shift ;;
  esac
done
[[ -n $(target_dir "$TARGET") ]] || {
  echo "error: unknown target '$TARGET' (have: $KNOWN_TARGETS)" >&2; exit 1; }

if [[ ${#skills[@]} -eq 0 ]]; then
  for d in "$HERE"/*/; do
    skills+=("$(basename "$d")")
  done
fi

echo "target: $TARGET -> $(target_dir "$TARGET")"
for s in "${skills[@]}"; do
  install_skill "$s"
done
